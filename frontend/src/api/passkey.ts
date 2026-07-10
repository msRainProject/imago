import { apiDelete, apiGet, apiPost } from './client';
import type {
  PasskeyCredential,
  WebAuthnChallengeResponse,
  WebAuthnVerifyResponse,
} from './types';
import { serializeCredential } from '@/utils/webauthn';

/**
 * GET /api/auth/webauthn/login/challenge[?username=...]
 * Returns the challenge + session_key for WebAuthn login assertion.
 *
 * When `username` is provided, the backend scopes the assertion to that
 * user's allowCredentials list. When omitted, the backend issues a
 * client-side discoverable (passkey) challenge — the browser surfaces its
 * native passkey chooser and the userHandle in the response identifies the
 * owning account server-side.
 */
export function fetchLoginChallenge(username?: string): Promise<WebAuthnChallengeResponse> {
  return apiGet<WebAuthnChallengeResponse>('/api/auth/webauthn/login/challenge', {
    params: username ? { username } : undefined,
  });
}

/**
 * POST /api/auth/webauthn/login/verify
 * Verifies the WebAuthn assertion produced by the authenticator.
 * On success, returns { token, user }.
 */
export async function verifyLogin(
  credential: PublicKeyCredential,
  session_key: string,
): Promise<WebAuthnVerifyResponse> {
  const serialized = serializeCredential(credential);
  return apiPost<WebAuthnVerifyResponse>('/api/auth/webauthn/login/verify', {
    credential: serialized,
    session_key,
  });
}

/**
 * GET /api/auth/webauthn/register/challenge
 * Returns the challenge + session_key for WebAuthn registration (attestation).
 * Requires JWT auth.
 */
export function fetchRegistrationChallenge(): Promise<WebAuthnChallengeResponse> {
  return apiGet<WebAuthnChallengeResponse>('/api/auth/webauthn/register/challenge');
}

/**
 * POST /api/auth/webauthn/register/verify
 * Submits the attestation from navigator.credentials.create().
 * On success, returns { registered: true }.
 * Requires JWT auth.
 */
export async function verifyRegistration(
  credential: PublicKeyCredential,
  session_key: string,
  friendly_name: string,
): Promise<WebAuthnVerifyResponse> {
  const serialized = serializeCredential(credential);
  return apiPost<WebAuthnVerifyResponse>('/api/auth/webauthn/register/verify', {
    credential: serialized,
    friendly_name,
    session_key,
  });
}

/**
 * GET /api/auth/webauthn/credentials
 * Returns the calling user's registered passkeys.
 * Requires JWT auth.
 */
export function listPasskeyCredentials(): Promise<PasskeyCredential[]> {
  return apiGet<PasskeyCredential[]>('/api/auth/webauthn/credentials');
}

/**
 * DELETE /api/auth/webauthn/credentials/:id
 * Removes a single passkey from the calling user.
 * Requires JWT auth.
 */
export function deletePasskeyCredential(credentialId: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(
    `/api/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`,
  );
}
