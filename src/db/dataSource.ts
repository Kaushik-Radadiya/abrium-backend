import 'reflect-metadata'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DataSource } from 'typeorm'
import { env } from '../config/env.js'
import { RiskAssessment } from '../entities/RiskAssessment.js'
import { User } from '../entities/User.js'
import { UserWallet } from '../entities/UserWallet.js'
import { WebhookEvent } from '../entities/WebhookEvent.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: env.DATABASE_URL,
  entities: [RiskAssessment, User, UserWallet, WebhookEvent],
  migrations: [
    join(currentDir, '../migrations/*.ts'),
    join(currentDir, '../migrations/*.js'),
  ],
  synchronize: false,
  logging: false,
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
