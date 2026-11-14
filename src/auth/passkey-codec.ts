// WebAuthn wire encoding: the gateway sends options and takes credentials as base64 (spec `format: byte`),
// while the browser API works in ArrayBuffers.

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the options JSON is decoded at runtime and its shape is the WebAuthn spec's, not ours */
// The gateway sends WebAuthn options as base64-encoded JSON (spec `format: byte`).
// Decode the envelope to an object before extracting the publicKey payload.
function parseOptionsEnvelope(raw: any): any {
  const decoded = typeof raw === "string" ? JSON.parse(atob(raw)) : raw;
  return decoded.publicKey ?? decoded;
}

export function decodeCreationOptions(raw: any): PublicKeyCredentialCreationOptions {
  const pk = parseOptionsEnvelope(raw);
  return {
    ...pk,
    challenge: base64urlToBuffer(pk.challenge),
    user: {...pk.user, id: base64urlToBuffer(pk.user.id)},
    excludeCredentials: (pk.excludeCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };
}

export function decodeRequestOptions(raw: any): PublicKeyCredentialRequestOptions {
  const pk = parseOptionsEnvelope(raw);
  return {
    ...pk,
    challenge: base64urlToBuffer(pk.challenge),
    allowCredentials: (pk.allowCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// The server's `credential` field is `bytes` (spec `format: byte`), so the
// WebAuthn credential JSON must be sent as a base64-encoded string, not an object.
function encodeCredential(credential: object): string {
  return btoa(JSON.stringify(credential));
}

export function serializeLoginCredential(cred: PublicKeyCredential): string {
  const response = cred.response as AuthenticatorAssertionResponse;
  return encodeCredential({
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      authenticatorData: bufferToBase64url(response.authenticatorData),
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  });
}

export function serializeRegistrationCredential(cred: PublicKeyCredential): string {
  const response = cred.response as AuthenticatorAttestationResponse;
  return encodeCredential({
    id: cred.id,
    rawId: bufferToBase64url(cred.rawId),
    type: cred.type,
    response: {
      attestationObject: bufferToBase64url(response.attestationObject),
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
    },
  });
}
