import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url)

function toSnakeCase(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

function toPascalCase(value: string) {
  return toSnakeCase(value)
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export function migrationNameParts(rawName: string) {
  const trimmed = rawName.trim()
  if (!trimmed) {
    throw new Error('Migration name is required')
  }

  const timestamp = Date.now()
  const slug = toSnakeCase(trimmed)
  if (!slug) {
    throw new Error('Migration name is invalid')
  }

  const className = `${toPascalCase(trimmed)}${timestamp}`
  return {
    timestamp,
    slug,
    className,
  }
}

export async function writeMigrationFile(
  filename: string,
  content: string
): Promise<string> {
  await mkdir(MIGRATIONS_DIR, { recursive: true })
  const fileUrl = new URL(filename, MIGRATIONS_DIR)
  await writeFile(fileUrl, content, { encoding: 'utf8', flag: 'wx' })
  return fileURLToPath(fileUrl)
}

export function escapeSqlTemplate(sql: string) {
  return sql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}
