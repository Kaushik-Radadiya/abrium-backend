import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRiskAssessmentCacheIndex20260227060000 implements MigrationInterface {
  name = 'AddRiskAssessmentCacheIndex20260227060000'

  // CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
  // Setting transaction = false tells TypeORM to run this migration
  // without wrapping it in BEGIN/COMMIT.
  transaction = false

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_risk_assessments_chain_token_created"
      ON "risk_assessments" ("chain_id", "token_address", "created_at" DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX CONCURRENTLY IF EXISTS "idx_risk_assessments_chain_token_created"
    `)
  }
}
