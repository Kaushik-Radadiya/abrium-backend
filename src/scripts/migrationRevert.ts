import { closeDataSource, initializeDataSource } from '../db/dataSource.js'

async function run() {
  const dataSource = await initializeDataSource()
  await dataSource.undoLastMigration({ transaction: 'all' })

  // eslint-disable-next-line no-console
  console.log('Reverted last migration')
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('migration revert failed', error)
    process.exitCode = 1
  })
  .finally(closeDataSource)
