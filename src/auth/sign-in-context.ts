import {shared} from "../shared-runtime";
import {readStoreCookies} from "./cookie";
import {currentSignIn} from "./sign-in-cookies";

const state = shared("signInContext", () => ({generation: 0}));

export const invalidateSignInContext = (): void => {
  state.generation += 1;
};

export const captureSignInContext = () => {
  const stored = readStoreCookies();
  return {generation: state.generation, marker: currentSignIn(stored), limited: stored["limitedAccessToken"]};
};

export const isSignInContextCurrent = (context: ReturnType<typeof captureSignInContext>): boolean => {
  const current = captureSignInContext();
  return current.generation === context.generation && current.marker === context.marker && current.limited === context.limited;
};
