import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z
    .string()
    .default('http://localhost:3000')
    .transform((s) => s.replace(/\/+$/, '')),
  DYNAMIC_WEBHOOK_SECRET: z.string().optional(),
  GOPLUS_APP_KEY: z.string().optional(),
  GOPLUS_APP_SECRET: z.string().optional(),
  GOPLUS_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
  GOPLUS_TOKEN_SECURITY_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(1800),
  GOPLUS_TOKEN_SECURITY_CACHE_MAX_ENTRIES: z.coerce
    .number()
    .int()
    .positive()
    .default(1000),
  STARGATE_BASE_URL: z
    .string()
    .url()
    .default('https://stargate.finance/api/v2'),
  STARGATE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(20),
  CATALOG_CHAINS_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(3600),
  CATALOG_TOKENS_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(1800),
});

export const env = schema.parse(process.env);
