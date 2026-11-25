/**
 * A subscriber may call back into the SDK, which then reads the stores and the
 * cookies as the truth. Heard halfway through a change, that mixes two states:
 * it can erase a new sign-in, or file one account's refresh token under another.
 */
import {batch} from "nanostores";
import {shared} from "../shared-runtime";

// Shared like the stores: only the nanostores copy that made them can hold their notifications back.
const storeBatch = shared("storeBatch", () => batch);

/** Applies a synchronous change to the stores and the cookies beside them before any subscriber hears of it. */
export const commit = <T>(change: () => T): T => {
  let result!: T;
  storeBatch(() => {
    result = change();
  });
  return result;
};
