import {describe, it, expect} from "vite-plus/test";
import fc from "fast-check";
import {base64urlToBuffer, bufferToBase64url} from "../../auth/passkey-codec";

describe("[property] passkey base64url codec", () => {
  it("decoding what was encoded returns the same bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({maxLength: 256}), (bytes) => {
        const roundTripped = new Uint8Array(base64urlToBuffer(bufferToBase64url(bytes.buffer as ArrayBuffer)));
        expect(Array.from(roundTripped)).toEqual(Array.from(bytes));
      })
    );
  });

  it("encodes to the URL-safe alphabet without padding", () => {
    fc.assert(
      fc.property(fc.uint8Array({maxLength: 256}), (bytes) => {
        expect(bufferToBase64url(bytes.buffer as ArrayBuffer)).toMatch(/^[A-Za-z0-9_-]*$/);
      })
    );
  });
});
