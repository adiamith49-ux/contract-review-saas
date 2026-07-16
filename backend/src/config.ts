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
