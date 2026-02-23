import { closeDataSource, initializeDataSource } from '../db/dataSource.js'

async function run() {
  const dataSource = await initializeDataSource()

  await dataSource.query(`
    drop schema if exists public cascade;
    create schema public;
  `)

  const appliedMigrations = await dataSource.runMigrations({ transaction: 'all' })

  // eslint-disable-next-line no-console
  console.log(
    `Database reset complete: dropped all tables and applied ${appliedMigrations.length} migration(s)`
  )
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('database reset failed', error)
    process.exitCode = 1
  })
  .finally(closeDataSource)
