import {shared} from "../shared-runtime";
import {GLOBAL_PREFIX} from "./constants";

const REFRESH_LOCK = `${GLOBAL_PREFIX}_refresh`;
// Requests have no timeout, so a tab whose refresh hangs would hold the lock and
// stall every other tab behind it.
const REFRESH_LOCK_WAIT_MS = 10_000;

type RefreshTask<T> = () => Promise<T>;

/** Runs the refresh under a lock held across tabs, where the browser has one. */
const acrossTabs = async <T>(lock: string, task: RefreshTask<T>): Promise<T> => {
  if (typeof navigator === "undefined" || !navigator.locks) return task();

  let granted = false;
  try {
    return await navigator.locks.request(lock, {signal: AbortSignal.timeout(REFRESH_LOCK_WAIT_MS)}, () => {
      granted = true;
      return task();
    });
  } catch (error) {
    // Waited too long for the lock: refresh without it, as browsers without locks do.
    if (!granted && error instanceof DOMException && error.name === "TimeoutError") return task();
    throw error;
  }
};

const tails = shared("signInRotationQueues", () => new Map<string, Promise<void>>());

/** Serializes rotations for one sign-in without waiting for a previous sign-in's requests. */
export const serializeRefresh = <T>(signIn: string | undefined, task: RefreshTask<T>): Promise<T> => {
  const lock = signIn ? `${REFRESH_LOCK}:${signIn}` : REFRESH_LOCK;
  const run = (tails.get(lock) ?? Promise.resolve()).then(() => acrossTabs(lock, task));
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  tails.set(lock, tail);
  void tail.then(() => {
    if (tails.get(lock) === tail) tails.delete(lock);
  });
  return run;
};
