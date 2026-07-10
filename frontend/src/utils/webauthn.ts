/**
 * Hill Images — WebAuthn base64url codec.
 *
 * The PHP backend (WebAuthnHelper.php) speaks base64url without padding.
 * Browsers' `PublicKeyCredential` API wants `BufferSource` (Uint8Array
 * or ArrayBuffer) for `challenge`, `user.id`, and `credential.id`.
 *
 * This module bridges the two: server → browser for inbound values,
 * browser → server for outbound assertions.
 */

/** Convert a base64url string (no padding) into a Uint8Array<ArrayBuffer>. */
export function base64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  // Restore padding (length must be a multiple of 4).
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** Convert a Uint8Array (or ArrayBuffer) into a base64url string (no padding). */
export function bytesToBase64url(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Serialize a `PublicKeyCredential` (assertion OR attestation) for the
 * server. The PHP verifier expects a JSON object whose `response` fields
 * are base64url-encoded byte strings.
 *
 * See API.md § WebAuthn / Passkey for the exact shape.
 */
export function serializeCredential(cred: PublicKeyCredential): {
  id: string;
  rawId: string;
  type: string;
  response: Record<string, string>;
  clientExtensionResults?: AuthenticationExtensionsClientOutputs;
} {
  const rawId = bytesToBase64url(cred.rawId);
  const response = cred.response as AuthenticatorResponse & {
    clientDataJSON: ArrayBuffer;
    authenticatorData?: ArrayBuffer;
    signature?: ArrayBuffer;
    userHandle?: ArrayBuffer | null;
    attestationObject?: ArrayBuffer;
  };

  const out: {
    id: string;
    rawId: string;
    type: string;
    response: Record<string, string>;
    clientExtensionResults?: AuthenticationExtensionsClientOutputs;
  } = {
    id: rawId,
    rawId,
    type: cred.type,
    response: {
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
    },
  };

  // Assertion fields (login)
  if ('authenticatorData' in response && response.authenticatorData) {
    out.response.authenticatorData = bytesToBase64url(response.authenticatorData);
  }
  if ('signature' in response && response.signature) {
    out.response.signature = bytesToBase64url(response.signature);
  }
  if ('userHandle' in response && response.userHandle) {
    out.response.userHandle = bytesToBase64url(response.userHandle);
  }

  // Attestation fields (registration)
  if ('attestationObject' in response && response.attestationObject) {
    out.response.attestationObject = bytesToBase64url(response.attestationObject);
  }

  if (cred.getClientExtensionResults) {
    out.clientExtensionResults = cred.getClientExtensionResults();
  }

  return out;
}
