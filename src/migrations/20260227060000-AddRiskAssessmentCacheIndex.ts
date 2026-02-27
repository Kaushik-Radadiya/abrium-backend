import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddRiskAssessmentCacheIndex20260227060000 implements MigrationInterface {
  name = 'AddRiskAssessmentCacheIndex20260227060000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_risk_assessments_chain_token_created"
      ON "risk_assessments" ("chain_id", "token_address", "created_at" DESC)
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_risk_assessments_chain_token_created"
    `)
  }
}
