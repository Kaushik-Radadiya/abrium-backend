import {
  migrationNameParts,
  writeMigrationFile,
} from './migrationFileUtils.js'

async function run() {
  const input = process.argv.slice(2).join(' ').trim()
  if (!input) {
    throw new Error('Usage: npm run migration:create -- <name>')
  }

  const { timestamp, slug, className } = migrationNameParts(input)
  const filename = `${timestamp}-${slug}.ts`

  const content = `import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ${className} implements MigrationInterface {
  name = '${className}'

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Add forward migration SQL here.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Add rollback SQL here.
  }
}
`

  const filePath = await writeMigrationFile(filename, content)
  // eslint-disable-next-line no-console
  console.log(`Created migration: ${filePath}`)
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('migration create failed', error)
  process.exitCode = 1
})
