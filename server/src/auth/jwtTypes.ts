/**
 * JWT Configuration Types (DD-V2-227)
 *
 * Current: HMAC-SHA256 (symmetric, secret-based)
 * Target: ES256 (ECDSA P-256, asymmetric key pair)
 *
 * Migration plan:
 * 1. Generate ES256 key pair:
 *      openssl ecparam -genkey -name prime256v1 -noout -out es256-private.pem
 * 2. Extract public key:
 *      openssl ec -in es256-private.pem -pubout -out es256-public.pem
 * 3. Update @fastify/jwt config to use algorithm: 'ES256', key: { private, public }
 * 4. Add key-id (kid) header for key rotation without invalidating existing tokens
 * 5. Store private key in env var JWT_PRIVATE_KEY (never in code)
 *
 * Benefits:
 * - Any service can verify tokens with only the public key
 * - Private key never leaves the auth server
 * - Standard JOSE/JWT tooling supports ES256 natively
 */

/**
 * JWT signing and verification configuration.
 * Describes both the current HS256 implementation and the planned ES256 target.
 */
export interface JwtConfig {
  /** Current: 'HS256', Target: 'ES256' */
  algorithm: 'HS256' | 'ES256'
  /** Current: shared secret, Target: private key PEM */
  signingKey: string
  /** Target only: public key PEM for verification */
  verifyKey?: string
  /** Token expiry duration string e.g. '15m' */
  accessExpiry: string
  /** Refresh token expiry duration string e.g. '7d' */
  refreshExpiry: string
}

/**
 * JWT payload structure for Recall Rogue access and refresh tokens.
 * The `kid` field enables key rotation: when a new key pair is deployed,
 * old tokens signed with the previous key-id remain verifiable until they expire.
 */
export interface JwtPayloadV2 {
  /** User UUID (subject claim). */
  sub: string
  /** User email address, embedded for convenience. */
  email: string
  /** Token type — access tokens are short-lived; refresh tokens are long-lived. */
  type: 'access' | 'refresh'
  /** Key-id for rotation — identifies which key pair signed this token. */
  kid?: string
  /** Issued-at timestamp (seconds since epoch). */
  iat: number
  /** Expiry timestamp (seconds since epoch). */
  exp: number
}
