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
});

export const config = EnvSchema.parse(process.env);
