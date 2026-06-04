import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url().default("http://localhost:54321"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("dev-placeholder"),
  CLERK_SECRET_KEY: z.string().default("dev-placeholder"),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().default("dev-placeholder"),
  AWS_SECRET_ACCESS_KEY: z.string().default("dev-placeholder"),
  S3_BUCKET_NAME: z.string().default("contralyn-contracts"),
  ANTHROPIC_API_KEY: z.string().default("dev-placeholder"),
  AI_MODEL: z.string().default("claude-sonnet-4-6"),
});

export const config = EnvSchema.parse(process.env);
