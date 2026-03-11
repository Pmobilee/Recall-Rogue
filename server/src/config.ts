/**
 * Environment configuration for the Recall Rogue server.
 * Reads values from process.env (populated via dotenv at startup).
 * All fields are validated and typed; missing required values throw at boot.
 */

import "dotenv/config";
import { readFileSync } from "fs";

/** Parsed and validated server configuration. */
export interface Config {
  /** TCP port the Fastify server listens on. */
  port: number;
  /** Node environment ("development" | "production" | "test"). */
  nodeEnv: string;
  /** Secret used to sign and verify JWTs. Must be long and random in prod. */
  jwtSecret: string;
  /** Expiry string for access tokens (e.g. "15m"). */
  jwtExpiry: string;
  /** Expiry string for refresh tokens (e.g. "7d"). */
  refreshExpiry: string;
  /** Database connection string. SQLite path for dev, postgres:// URL for prod. */
  databaseUrl: string;
  /** Allowed CORS origin(s). Comma-separated list or single origin. */
  corsOrigin: string | string[];
  /** True when running in production mode. */
  isProduction: boolean;
  /** Admin API key for fact management endpoints. */
  adminApiKey: string;
  /** Anthropic API key for LLM features (dedup, categorization, generation). */
  anthropicApiKey: string;
  /** ComfyUI server URL for pixel art generation. */
  comfyuiUrl: string;
  /** Minimum confidence score for a distractor to be served (default 0.7). */
  distractorConfidenceThreshold: number;
  /** Maximum number of requests per rate-limit window (default 20). */
  rateLimitMax: number;
  /** Rate-limit window duration in milliseconds (default 60000). */
  rateLimitWindow: number;
  /** From email address for outbound mail (optional). */
  fromEmail?: string;
  /** Base URL used when constructing password reset links (default: localhost). */
  passwordResetBaseUrl: string;
  /** RevenueCat server API key for receipt verification. */
  revenuecatApiKey: string;
  /** RevenueCat S2S webhook shared secret (Authorization header value). */
  revenuecatWebhookSecret: string;
  /** Resend API key for transactional email delivery. */
  resendApiKey: string;
  /** Base URL for email unsubscribe links. */
  emailUnsubscribeBaseUrl: string;
  /** Firebase Cloud Messaging project ID. */
  fcmProjectId: string;
  /** FCM service account client email. */
  fcmClientEmail: string;
  /** FCM service account private key (PEM, newlines as \n). */
  fcmPrivateKey: string;
  /** Azure Cognitive Services TTS subscription key. */
  azureSpeechKey: string;
  /** Azure region for the TTS endpoint (e.g. "eastus"). */
  azureSpeechRegion: string;
  /** Email address for retention alert notifications (optional). */
  alertEmail?: string;
  /** Public server URL for dashboard links in alert emails (optional). */
  serverUrl?: string;
}

/**
 * Read a required environment variable, throwing if it is absent or empty.
 *
 * @param key - The environment variable name.
 * @param fallback - Optional default value; if omitted the variable is required.
 * @returns The resolved string value.
 */
function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Read an environment variable with a fallback, allowing empty string result.
 * Used for optional keys like ANTHROPIC_API_KEY that default to empty in dev.
 *
 * @param key - The environment variable name.
 * @param fallback - Default value if the variable is not set.
 * @returns The resolved string value (may be empty string).
 */
function envOptional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

/**
 * Read an optional environment variable, returning undefined if not set or empty.
 *
 * @param key - The environment variable name.
 * @returns The value string, or undefined if absent/empty.
 */
function envMaybe(key: string): string | undefined {
  const value = process.env[key];
  return value !== undefined && value !== "" ? value : undefined;
}

/**
 * Read an env var, falling back to a Docker secret file at /run/secrets/<secretName>.
 * Returns empty string if neither source is available (dev mode).
 *
 * @param envKey - The environment variable name to check first.
 * @param secretName - The Docker secret name (filename under /run/secrets/).
 * @returns The resolved string value, or empty string if unavailable.
 */
function readDockerSecret(envKey: string, secretName: string): string {
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(`/run/secrets/${secretName}`, "utf-8").trim();
  } catch {
    return "";
  }
}

const rawCors = env("CORS_ORIGIN", "http://localhost:5173");

/** Singleton configuration object populated from environment variables. */
export const config: Config = {
  port: parseInt(env("PORT", "3001"), 10),
  nodeEnv: env("NODE_ENV", "development"),
  jwtSecret: env("JWT_SECRET", "dev-secret-change-me"),
  jwtExpiry: env("JWT_EXPIRY", "15m"),
  refreshExpiry: env("REFRESH_EXPIRY", "7d"),
  databaseUrl: env("DATABASE_URL", "./data/recall-rogue.db"),
  corsOrigin: rawCors.includes(",")
    ? rawCors.split(",").map((s) => s.trim())
    : rawCors,
  isProduction: env("NODE_ENV", "development") === "production",
  adminApiKey: env("ADMIN_API_KEY", "dev-admin-key-change-me"),
  anthropicApiKey: envOptional("ANTHROPIC_API_KEY", ""),
  comfyuiUrl: env("COMFYUI_URL", "http://localhost:8188"),
  distractorConfidenceThreshold: parseFloat(
    env("DISTRACTOR_CONFIDENCE_THRESHOLD", "0.7")
  ),
  rateLimitMax: parseInt(env("RATE_LIMIT_MAX", "20"), 10),
  rateLimitWindow: parseInt(env("RATE_LIMIT_WINDOW_MS", "60000"), 10),
  fromEmail: envMaybe("FROM_EMAIL"),
  passwordResetBaseUrl: env(
    "PASSWORD_RESET_BASE_URL",
    "http://localhost:5173/reset-password"
  ),
  // ── Monetisation (RevenueCat) ───────────────────────────────────────────────
  revenuecatApiKey: readDockerSecret(
    "REVENUECAT_API_KEY",
    "revenuecat_api_key"
  ),
  revenuecatWebhookSecret: readDockerSecret(
    "REVENUECAT_WEBHOOK_SECRET",
    "revenuecat_webhook_secret"
  ),
  // ── Email (Resend) ──────────────────────────────────────────────────────────
  resendApiKey: readDockerSecret("RESEND_API_KEY", "resend_api_key"),
  emailUnsubscribeBaseUrl: env(
    "EMAIL_UNSUBSCRIBE_BASE_URL",
    "http://localhost:3001/api/email/unsubscribe"
  ),
  // ── Push Notifications (FCM) ────────────────────────────────────────────────
  fcmProjectId: envOptional("FCM_PROJECT_ID", ""),
  fcmClientEmail: envOptional("FCM_CLIENT_EMAIL", ""),
  fcmPrivateKey: readDockerSecret("FCM_PRIVATE_KEY", "fcm_private_key"),
  // ── TTS (Azure Cognitive Services) ─────────────────────────────────────────
  azureSpeechKey: readDockerSecret("AZURE_SPEECH_KEY", "azure_speech_key"),
  azureSpeechRegion: envOptional("AZURE_SPEECH_REGION", "eastus"),
  // ── Analytics Alerts (Phase 41.5) ──────────────────────────────────────────
  alertEmail: envMaybe("ALERT_EMAIL"),
  serverUrl: envMaybe("SERVER_URL"),
};

/**
 * Validate production-critical environment variables at boot.
 * Call this inside start() before buildApp().
 * Exits the process with a descriptive error on failure.
 */
export function validateProductionConfig(): void {
  if (!config.isProduction) return;

  const required: [keyof Config, string][] = [
    ["jwtSecret", "JWT_SECRET (min 64 chars, random)"],
    ["adminApiKey", "ADMIN_API_KEY"],
    ["revenuecatApiKey", "REVENUECAT_API_KEY"],
    ["revenuecatWebhookSecret", "REVENUECAT_WEBHOOK_SECRET"],
    ["resendApiKey", "RESEND_API_KEY"],
  ];

  const missing = required.filter(([key]) => !config[key]);
  if (missing.length > 0) {
    console.error(
      "[Config] FATAL: Missing required production environment variables:"
    );
    for (const [, label] of missing) console.error(`  - ${label}`);
    process.exit(1);
  }

  if (config.jwtSecret.length < 64) {
    console.error(
      "[Config] FATAL: JWT_SECRET must be at least 64 characters in production"
    );
    process.exit(1);
  }

  const corsOrigins = Array.isArray(config.corsOrigin)
    ? config.corsOrigin
    : [config.corsOrigin];
  if (corsOrigins.some((origin) => origin.trim() === "*")) {
    console.error(
      "[Config] FATAL: CORS_ORIGIN must not contain wildcard '*' in production"
    );
    process.exit(1);
  }
}
