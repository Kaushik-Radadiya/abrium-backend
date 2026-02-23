import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  DYNAMIC_WEBHOOK_SECRET: z.string().optional(),
  GOPLUS_BASE_URL: z
    .string()
    .default('https://api.gopluslabs.io/api/v1/token_security')
})

export const env = schema.parse(process.env)
