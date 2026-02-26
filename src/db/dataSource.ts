import 'reflect-metadata'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DataSource } from 'typeorm'
import { env } from '../config/env.js'
import { CatalogChain } from '../entities/CatalogChain.js'
import { CatalogToken } from '../entities/CatalogToken.js'
import { RiskAssessment } from '../entities/RiskAssessment.js'
import { User } from '../entities/User.js'
import { UserWallet } from '../entities/UserWallet.js'
import { WebhookEvent } from '../entities/WebhookEvent.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [
    CatalogChain,
    CatalogToken,
    RiskAssessment,
    User,
    UserWallet,
    WebhookEvent,
  ],
  migrations: [
    join(currentDir, '../migrations/*.ts'),
    join(currentDir, '../migrations/*.js'),
  ],
  synchronize: false,
  logging: false,
  // Keep a stable pool of connections to avoid reconnecting on every request.
  // Render's managed Postgres recycles idle connections aggressively, so we
  // use keepAlive + a short idle timeout to evict stale connections before
  // Render does it for us (prevents "terminating connection due to idle" errors).
  poolSize: 5,
  extra: {
    // TCP keepalive so the OS sends probes on idle connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    // How long a client can sit idle in the pool before being destroyed
    idleTimeoutMillis: 30_000,
    // Max time to wait for a new connection to be established
    connectionTimeoutMillis: 5_000,
  },
})

let initializationPromise: Promise<DataSource> | null = null

export async function initializeDataSource() {
  if (AppDataSource.isInitialized) {
    return AppDataSource
  }

  if (!initializationPromise) {
    initializationPromise = AppDataSource.initialize().catch((error) => {
      initializationPromise = null
      throw error
    })
  }

  return initializationPromise
}

export async function closeDataSource() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy()
  }
}

export default AppDataSource
