import { closeDataSource, initializeDataSource } from '../db/dataSource.js'

type AppliedMigrationRow = {
  id: number
  timestamp: string
  name: string
}

async function run() {
  const dataSource = await initializeDataSource()
  await dataSource.query(`
    create table if not exists "migrations" (
      "id" serial primary key,
      "timestamp" bigint not null,
      "name" varchar not null
    )
  `)

  const appliedRows = (await dataSource.query(
    `select id, timestamp, name from "migrations" order by id asc`
  )) as AppliedMigrationRow[]
  const appliedNames = new Set(appliedRows.map((row) => row.name))
  const allMigrationNames = dataSource.migrations
    .map((migration) => migration.name)
    .filter((name): name is string => typeof name === 'string')
  const pendingNames = allMigrationNames.filter(
    (name) => !appliedNames.has(name)
  )

  // eslint-disable-next-line no-console
  console.log(`Applied: ${appliedRows.length}`)
  for (const row of appliedRows) {
    // eslint-disable-next-line no-console
    console.log(`  - ${row.name}`)
  }

  // eslint-disable-next-line no-console
  console.log(`Pending: ${pendingNames.length}`)
  for (const name of pendingNames) {
    // eslint-disable-next-line no-console
    console.log(`  - ${name}`)
  }
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('migration show failed', error)
    process.exitCode = 1
  })
  .finally(closeDataSource)
