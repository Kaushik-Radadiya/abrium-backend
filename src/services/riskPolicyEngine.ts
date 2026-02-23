import type { RiskBadge, RiskEvaluation } from '../types/security.js'

type GoPlusDexItem = {
  liquidity?: unknown
  liquidity_usd?: unknown
  liquidityUsd?: unknown
}

type GoPlusRisk = Record<string, unknown> & {
  is_honeypot?: string
  is_open_source?: string
  is_proxy?: string
  selfdestruct?: string
  owner_change_balance?: string
  hidden_owner?: string
  is_mintable?: string
  slippage_modifiable?: string
  transfer_pausable?: string
  is_blacklisted?: string
  sell_tax?: string
  buy_tax?: string
  trust_list?: string
  owner_address?: string
  dex?: GoPlusDexItem[] | Record<string, GoPlusDexItem>
}

const BASE_SCORE = 100
const HIGH_LIQUIDITY_USD = 100_000

const EMPTY_OWNER_ADDRESSES = new Set([
  '',
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x000000000000000000000000000000000000dEaD',
])

function uniqueList(values: string[]) {
  return Array.from(new Set(values))
}

function clampScore(score: number) {
  if (score < 0) return 0
  if (score > 100) return 100
  return Math.round(score)
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/[%,$\s]/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTaxPercent(value: unknown): number | null {
  const numeric = parseNumber(value)
  if (numeric === null) return null
  if (numeric >= 0 && numeric <= 1) return numeric * 100
  return numeric
}

function isTruthyFlag(value: unknown) {
  if (value === true || value === 1 || value === '1') return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === 'yes'
}

function isFalseFlag(value: unknown) {
  if (value === false || value === 0 || value === '0') return true
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'false' || normalized === 'no'
}

function formatUsd(value: number) {
  return Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)
}

function extractMaxDexLiquidityUsd(risk: GoPlusRisk): number | null {
  const source = risk.dex
  const rows: unknown[] = Array.isArray(source)
    ? source
    : source && typeof source === 'object'
      ? Object.values(source)
      : []

  let maxLiquidity: number | null = null

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as GoPlusDexItem
    const liquidity =
      parseNumber(record.liquidity_usd) ??
      parseNumber(record.liquidityUsd) ??
      parseNumber(record.liquidity)

    if (liquidity === null) continue
    if (maxLiquidity === null || liquidity > maxLiquidity) {
      maxLiquidity = liquidity
    }
  }

  return maxLiquidity
}

function assessGoPlusRisk(risk: GoPlusRisk) {
  const criticalFlags: string[] = []
  const warningFlags: string[] = []
  const trustSignals: string[] = []
  const reasons: string[] = []
  const badges: RiskBadge[] = []

  let penalties = 0
  let bonuses = 0

  const ownerAddress =
    typeof risk.owner_address === 'string' ? risk.owner_address.trim() : ''
  const ownershipAbandoned = EMPTY_OWNER_ADDRESSES.has(ownerAddress)
  const buyTaxPercent = parseTaxPercent(risk.buy_tax)
  const sellTaxPercent = parseTaxPercent(risk.sell_tax)
  const maxDexLiquidityUsd = extractMaxDexLiquidityUsd(risk)

  const addCritical = (id: string, label: string, detail: string, penalty = 80) => {
    criticalFlags.push(id)
    reasons.push(detail)
    penalties += penalty
    badges.push({ id, label, detail, level: 'error' })
  }

  const addWarning = (id: string, label: string, detail: string, penalty: number) => {
    warningFlags.push(id)
    reasons.push(detail)
    penalties += penalty
    badges.push({ id, label, detail, level: 'warning' })
  }

  const addTrust = (id: string, label: string, detail: string, bonus: number) => {
    trustSignals.push(id)
    reasons.push(detail)
    bonuses += bonus
    badges.push({ id, label, detail, level: 'info' })
  }

  if (isTruthyFlag(risk.is_honeypot)) {
    addCritical('is_honeypot', 'Honeypot', 'Honeypot behavior detected.')
  }
  if (isFalseFlag(risk.is_open_source)) {
    addCritical(
      'is_open_source_false',
      'Closed Source',
      'Contract source is not open or verified.',
    )
  }
  if (isTruthyFlag(risk.is_proxy)) {
    addCritical(
      'is_proxy',
      'Proxy Contract',
      'Contract is proxy-upgradable and can change behavior.',
    )
  }
  if (isTruthyFlag(risk.selfdestruct)) {
    addCritical(
      'selfdestruct',
      'Self Destruct',
      'Contract can be self-destructed by privileged role.',
    )
  }
  if (isTruthyFlag(risk.owner_change_balance)) {
    addCritical(
      'owner_change_balance',
      'Owner Balance Control',
      'Owner can change holder balances.',
    )
  }
  if (buyTaxPercent !== null && buyTaxPercent >= 100) {
    addCritical(
      'buy_tax_100',
      'Buy Tax 100%',
      `Buy tax is ${buyTaxPercent.toFixed(2)}%.`,
    )
  }
  if (sellTaxPercent !== null && sellTaxPercent >= 100) {
    addCritical(
      'sell_tax_100',
      'Sell Tax 100%',
      `Sell tax is ${sellTaxPercent.toFixed(2)}%.`,
    )
  }

  // Tier 2: warning checks
  if (isTruthyFlag(risk.hidden_owner)) {
    addWarning(
      'hidden_owner',
      'Hidden Owner',
      'Hidden ownership controls detected.',
      20,
    )
  }
  if (isTruthyFlag(risk.is_mintable)) {
    addWarning(
      'is_mintable',
      'Mintable Supply',
      ownershipAbandoned
        ? 'Minting is enabled, but owner appears abandoned (risk reduced).'
        : 'Token supply can be minted by owner.',
      ownershipAbandoned ? 8 : 24,
    )
  }
  if (isTruthyFlag(risk.slippage_modifiable)) {
    addWarning(
      'slippage_modifiable',
      'Tax Modifiable',
      ownershipAbandoned
        ? 'Slippage is modifiable, but owner appears abandoned (risk reduced).'
        : 'Owner can modify tax/slippage parameters.',
      ownershipAbandoned ? 8 : 22,
    )
  }
  if (isTruthyFlag(risk.transfer_pausable)) {
    addWarning(
      'transfer_pausable',
      'Transfer Pausable',
      'Owner can pause transfers at any time.',
      20,
    )
  }
  if (isTruthyFlag(risk.is_blacklisted)) {
    addWarning(
      'is_blacklisted',
      'Blacklist Control',
      'Owner can blacklist specific addresses.',
      30,
    )
  }

  if (buyTaxPercent !== null && buyTaxPercent >= 20 && buyTaxPercent < 100) {
    addWarning(
      'buy_tax_high',
      'High Buy Tax',
      `Buy tax is ${buyTaxPercent.toFixed(2)}%.`,
      18,
    )
  }
  if (sellTaxPercent !== null && sellTaxPercent >= 20 && sellTaxPercent < 100) {
    addWarning(
      'sell_tax_high',
      'High Sell Tax',
      `Sell tax is ${sellTaxPercent.toFixed(2)}%.`,
      18,
    )
  }

  // Tier 3: trust / reliability signals
  if (isTruthyFlag(risk.trust_list)) {
    addTrust(
      'trust_list',
      'Trust List',
      'Token appears on provider trust list.',
      18,
    )
  }
  if (maxDexLiquidityUsd !== null && maxDexLiquidityUsd > HIGH_LIQUIDITY_USD) {
    addTrust(
      'dex_liquidity_high',
      'High Liquidity',
      `DEX liquidity is $${formatUsd(maxDexLiquidityUsd)}.`,
      12,
    )
  }
  if (ownershipAbandoned) {
    addTrust(
      'ownership_abandoned',
      'Ownership Abandoned',
      'Owner address is empty or burn address.',
      8,
    )
  }

  return {
    score: clampScore(BASE_SCORE - penalties + bonuses),
    criticalFlags: uniqueList(criticalFlags),
    warningFlags: uniqueList(warningFlags),
    trustSignals: uniqueList(trustSignals),
    flags: uniqueList([...criticalFlags, ...warningFlags]),
    reasons: uniqueList(reasons),
    badges,
    metrics: {
      buyTaxPercent,
      sellTaxPercent,
      maxDexLiquidityUsd,
      ownershipAbandoned,
    },
  }
}

export function evaluateGoPlusRisk(risk: GoPlusRisk): RiskEvaluation {
  const assessment = assessGoPlusRisk(risk)

  if (assessment.criticalFlags.length > 0) {
    return {
      ...assessment,
      decision: 'BLOCK',
      alertLevel: 'error',
      alertTitle: 'Token blocked by policy',
      alertMessage: assessment.reasons[0] ?? 'Critical token risks found.',
    }
  }

  if (assessment.warningFlags.length === 0) {
    return {
      ...assessment,
      decision: 'ALLOW',
      alertLevel: 'info',
      alertTitle: 'Token check complete',
      alertMessage:
        assessment.trustSignals.length > 0
          ? 'No major token risks found. Trust signals detected.'
          : 'No major token risks found.',
    }
  }

  if (assessment.score <= 30) {
    return {
      ...assessment,
      decision: 'BLOCK',
      alertLevel: 'error',
      alertTitle: 'Token blocked by policy',
      alertMessage:
        assessment.reasons[0] ?? 'Risk score is below the policy threshold.',
    }
  }

  return {
    ...assessment,
    decision: 'WARN',
    alertLevel: 'warning',
    alertTitle: 'Proceed with caution',
    alertMessage: assessment.reasons[0] ?? 'Potential token risks detected.',
  }
}
