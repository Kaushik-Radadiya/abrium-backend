import { closeDataSource, initializeDataSource } from '../db/dataSource.js'
import {
  escapeSqlTemplate,
  migrationNameParts,
  writeMigrationFile,
} from './migrationFileUtils.js'

type SqlQuery = {
  query: string
  parameters?: unknown[]
}

function renderQueryLine(query: SqlQuery) {
  const escapedQuery = escapeSqlTemplate(query.query)
  if (query.parameters && query.parameters.length > 0) {
    return `    await queryRunner.query(\`${escapedQuery}\`, ${JSON.stringify(query.parameters)})`
  }

  return `    await queryRunner.query(\`${escapedQuery}\`)`
}

async function run() {
  const input = process.argv.slice(2).join(' ').trim()
  if (!input) {
    throw new Error('Usage: npm run migration:generate -- <name>')
  }

  const dataSource = await initializeDataSource()
  const sqlInMemory = await dataSource.driver.createSchemaBuilder().log()
  const upQueries = sqlInMemory.upQueries as SqlQuery[]
  const downQueries = sqlInMemory.downQueries as SqlQuery[]

  if (upQueries.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No schema changes detected. Migration not created.')
    return
  }

  const { timestamp, slug, className } = migrationNameParts(input)
  const filename = `${timestamp}-${slug}.ts`
  const upBody = upQueries.map(renderQueryLine).join('\n')
  const downBody = downQueries.map(renderQueryLine).join('\n')

  const content = `import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ${className} implements MigrationInterface {
  name = '${className}'

  public async up(queryRunner: QueryRunner): Promise<void> {
${upBody}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${downBody}
  }
}
`

  const filePath = await writeMigrationFile(filename, content)
  // eslint-disable-next-line no-console
  console.log(`Generated migration: ${filePath}`)
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('migration generate failed', error)
    process.exitCode = 1
  })
  .finally(closeDataSource)
