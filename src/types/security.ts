export type RiskDecision = 'ALLOW' | 'WARN' | 'BLOCK'
export type RiskAlertLevel = 'info' | 'warning' | 'error'
export type RiskBadgeLevel = RiskAlertLevel

export type RiskBadge = {
  id: string
  label: string
  detail: string
  level: RiskBadgeLevel
}

export type TokenRiskMetrics = {
  buyTaxPercent: number | null
  sellTaxPercent: number | null
  maxDexLiquidityUsd: number | null
  ownershipAbandoned: boolean
}

export type RiskEvaluation = {
  decision: RiskDecision
  score: number
  flags: string[]
  criticalFlags: string[]
  warningFlags: string[]
  trustSignals: string[]
  reasons: string[]
  badges: RiskBadge[]
  metrics: TokenRiskMetrics
  alertLevel: RiskAlertLevel
  alertTitle: string
  alertMessage: string
}
