import { closeDataSource, initializeDataSource } from '../db/dataSource.js'

async function run() {
  const dataSource = await initializeDataSource()
  const appliedMigrations = await dataSource.runMigrations({
    transaction: 'all',
  })

  if (appliedMigrations.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No pending migrations')
    return
  }

  // eslint-disable-next-line no-console
  console.log(
    `Applied ${appliedMigrations.length} migration(s): ${appliedMigrations
      .map((migration) => migration.name)
      .join(', ')}`,
  )
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('migration failed', error)
    process.exitCode = 1
  })
  .finally(closeDataSource)
