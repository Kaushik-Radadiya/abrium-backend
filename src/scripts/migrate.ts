import { readFile } from 'node:fs/promises'
import { query, pool } from '../db/pool.js'

async function run() {
  const sql = await readFile(new URL('../../sql/schema_v0.sql', import.meta.url), 'utf8')
  await query(sql)
  // eslint-disable-next-line no-console
  console.log('schema_v0.sql applied successfully')
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('migration failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
