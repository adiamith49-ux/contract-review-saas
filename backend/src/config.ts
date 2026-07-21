import { z } from "zod";

const str = (fallback: string) =>
  z.preprocess(v => (typeof v === "string" ? v.trim() : v), z.string().default(fallback));

const EnvSchema = z.object({
  NODE_ENV: z.preprocess(
    v => (typeof v === "string" ? v.trim() : v),
    z.enum(["development", "test", "production"]).default("development")
  ),
  PORT: z.coerce.number().default(4000),
  WEB_URL: str("http://localhost:3000"),
  SUPABASE_URL: str("http://localhost:54321"),
  SUPABASE_SERVICE_ROLE_KEY: str("dev-placeholder"),
  CLERK_SECRET_KEY: str("dev-placeholder"),
  AWS_REGION: str("ap-south-1"),
  AWS_ACCESS_KEY_ID: str("dev-placeholder"),
  AWS_SECRET_ACCESS_KEY: str("dev-placeholder"),
  S3_BUCKET_NAME: str("contralyn-contracts"),
  ANTHROPIC_API_KEY: str("dev-placeholder"),
  AI_MODEL: str("claude-sonnet-4-6"),
  ADMIN_JWT_SECRET: str("change-me-admin-secret"),
  CLERK_WEBHOOK_SECRET: str(""),
  // SMTP — used for admin password-reset emails; reset is disabled when unset
  SMTP_HOST: str(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: str(""),
  SMTP_PASS: str(""),
  SMTP_FROM: str(""),
  // Where landing-page contact form submissions are delivered
  CONTACT_EMAIL: str("contact@contralyne.com"),
  // Marketing/landing origin (contact form posts from here). Leave empty when
  // the landing page and app share one domain (e.g. local dev).
  LANDING_URL: str(""),
});

export const config = EnvSchema.parse(process.env);

// ─── Fail-closed secret validation ───────────────────────────────────────────
// Every secret below has a dev-friendly fallback so local setup is painless.
// Most fail loudly in production anyway (a placeholder Supabase key just breaks
// every query). ADMIN_JWT_SECRET is the dangerous exception: with the default
// left in place, the admin panel keeps working and anyone who knows the default
// string can mint a valid admin token. A placeholder that GRANTS access is far
// worse than one that denies it — so refuse to boot rather than serve insecurely.
const PLACEHOLDER_SECRETS: Array<[keyof typeof config, string]> = [
  ["ADMIN_JWT_SECRET", "change-me-admin-secret"],
  ["SUPABASE_SERVICE_ROLE_KEY", "dev-placeholder"],
  ["CLERK_SECRET_KEY", "dev-placeholder"],
  ["ANTHROPIC_API_KEY", "dev-placeholder"],
  ["AWS_ACCESS_KEY_ID", "dev-placeholder"],
  ["AWS_SECRET_ACCESS_KEY", "dev-placeholder"],
];

if (config.NODE_ENV === "production") {
  const unset = PLACEHOLDER_SECRETS
    .filter(([key, placeholder]) => config[key] === placeholder)
    .map(([key]) => key);

  if (unset.length > 0) {
    throw new Error(
      `Refusing to start: ${unset.join(", ")} still ${unset.length === 1 ? "holds its" : "hold their"} ` +
      `development placeholder in production. Set ${unset.length === 1 ? "it" : "them"} in the Vercel ` +
      `environment before deploying.`
    );
  }

  // Non-fatal: a set-but-weak admin secret shouldn't take the API down, but it
  // should be impossible to miss in the logs. Use 32+ random bytes:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
  if (config.ADMIN_JWT_SECRET.length < 32) {
    console.warn(
      `[config] WARNING: ADMIN_JWT_SECRET is only ${config.ADMIN_JWT_SECRET.length} characters. ` +
      `This key signs admin access tokens — use 32+ random bytes, not a memorable phrase.`
    );
  }
} else if (config.ADMIN_JWT_SECRET === "change-me-admin-secret") {
  console.warn("[config] ADMIN_JWT_SECRET is the shared dev default — never deploy with this value.");
}
