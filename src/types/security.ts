export type RiskDecision = 'ALLOW' | 'WARN' | 'BLOCK'
export type SecurityLevel = 'verified' | 'caution' | 'danger'
export type RiskBadgeLevel = 'info' | 'warning' | 'error'

export type RiskBadge = {
  id: string
  label: string
  detail: string
  level: RiskBadgeLevel
}

export type RiskEvaluation = {
  decision: RiskDecision
  securityLevel: SecurityLevel
  criticalFlags: string[]
  reasons: string[]
  badges: RiskBadge[]
}
