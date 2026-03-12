import type {
  RiskBadge,
  RiskDecision,
  RiskEvaluation,
  SecurityLevel,
} from '../types/security.js';

type GoPlusDexItem = {
  liquidity?: unknown;
  liquidity_usd?: unknown;
  liquidityUsd?: unknown;
};

type GoPlusRisk = Record<string, unknown> & {
  is_honeypot?: string;
  cannot_sell_all?: string;
  hidden_owner?: string;
  is_mintable?: string;
  transfer_pausable?: string;
  is_proxy?: string;
  proxy_contract?: string;
  is_open_source?: string;
  is_blacklisted?: string;
  selfdestruct?: string;
  selfdestructable?: string;
  owner_change_balance?: string;
  can_take_back_ownership?: string;
  sell_tax?: string;
  buy_tax?: string;
  owner_address?: string;
  dex?: GoPlusDexItem[] | Record<string, GoPlusDexItem>;
};

const LOW_TAX_THRESHOLD_PERCENT = 10;
const HIGH_SELL_TAX_THRESHOLD_PERCENT = 100;

const EMPTY_OWNER_ADDRESSES = new Set([
  '',
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x000000000000000000000000000000000000dEaD',
]);

const SECURITY_LEVEL_BY_DECISION: Record<RiskDecision, SecurityLevel> = {
  ALLOW: 'verified',
  WARN: 'caution',
  BLOCK: 'danger',
};

function uniqueList(values: string[]) {
  return Array.from(new Set(values));
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[%,$\s]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTaxPercent(value: unknown): number | null {
  const numeric = parseNumber(value);
  if (numeric === null) return null;
  if (numeric >= 0 && numeric <= 1) return numeric * 100;
  return numeric;
}

function isTruthyFlag(value: unknown) {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes';
}

function assessGoPlusRisk(risk: GoPlusRisk) {
  const criticalFlags: string[] = [];
  const warningFlags: string[] = [];
  const reasons: string[] = [];
  const badges: RiskBadge[] = [];

  const buyTaxPercent = parseTaxPercent(risk.buy_tax);
  const sellTaxPercent = parseTaxPercent(risk.sell_tax);

  const ownerAddress =
    typeof risk.owner_address === 'string' ? risk.owner_address.trim() : '';
  const isOwnerRenounced = EMPTY_OWNER_ADDRESSES.has(ownerAddress);

  const hasHoneypot = isTruthyFlag(risk.is_honeypot);
  const hasCannotSellAll = isTruthyFlag(risk.cannot_sell_all);
  const hasHiddenOwner = isTruthyFlag(risk.hidden_owner);
  const hasMintable = isTruthyFlag(risk.is_mintable);
  const hasTransferPausable = isTruthyFlag(risk.transfer_pausable);
  const hasProxyUpgradable =
    isTruthyFlag(risk.is_proxy) || isTruthyFlag(risk.proxy_contract);
  const isOpenSource = isTruthyFlag(risk.is_open_source);
  const hasBlacklisting = isTruthyFlag(risk.is_blacklisted);
  const hasSelfDestructStyleControl =
    isTruthyFlag(risk.selfdestruct) ||
    isTruthyFlag(risk.selfdestructable) ||
    isTruthyFlag(risk.owner_change_balance) ||
    isTruthyFlag(risk.can_take_back_ownership);

  const addCritical = (id: string, label: string, detail: string) => {
    criticalFlags.push(id);
    reasons.push(detail);
    badges.push({ id, label, detail, level: 'error' });
  };

  const addWarning = (id: string, label: string, detail: string) => {
    warningFlags.push(id);
    reasons.push(detail);
    badges.push({ id, label, detail, level: 'warning' });
  };

  const addTrust = (id: string, label: string, detail: string) => {
    badges.push({ id, label, detail, level: 'info' });
  };

  // Danger rules
  if (hasHoneypot) {
    addCritical('is_honeypot', 'Honeypot', 'Honeypot behavior detected.');
  }

  if (hasCannotSellAll) {
    addCritical('cannot_sell_all', 'Cannot Sell All', 'Token cannot be fully sold.');
  }

  if (
    sellTaxPercent !== null &&
    sellTaxPercent >= HIGH_SELL_TAX_THRESHOLD_PERCENT
  ) {
    addCritical(
      'sell_tax_100',
      'Sell Tax >= 100%',
      `Sell tax is ${sellTaxPercent.toFixed(2)}%.`,
    );
  }

  if (hasBlacklisting && hasSelfDestructStyleControl) {
    addCritical(
      'abusive_control_combo',
      'Abusive Control Combination',
      'Blacklisting and self-destruct style controls are both enabled.',
    );
  }

  // Caution rules
  if (hasBlacklisting && !hasSelfDestructStyleControl) {
    addWarning(
      'blacklist_control',
      'Blacklist Control',
      'Contract owner can blacklist addresses.',
    );
  }

  if (hasSelfDestructStyleControl && !hasBlacklisting) {
    addWarning(
      'selfdestruct_control',
      'Self-Destruct / Owner Control',
      'Owner has destructive control functions.',
    );
  }
  if (hasMintable) {
    addWarning('is_mintable', 'Mintable Supply', 'Token supply can be minted by owner.');
  }

  if (hasHiddenOwner) {
    addWarning('hidden_owner', 'Hidden Owner', 'Hidden ownership controls detected.');
  }

  if (
    buyTaxPercent !== null &&
    buyTaxPercent >= LOW_TAX_THRESHOLD_PERCENT &&
    buyTaxPercent < HIGH_SELL_TAX_THRESHOLD_PERCENT
  ) {
    addWarning(
      'buy_tax_10_100',
      'Buy Tax >= 10%',
      `Buy tax is ${buyTaxPercent.toFixed(2)}%.`,
    );
  }

  if (
    sellTaxPercent !== null &&
    sellTaxPercent >= LOW_TAX_THRESHOLD_PERCENT &&
    sellTaxPercent < HIGH_SELL_TAX_THRESHOLD_PERCENT
  ) {
    addWarning(
      'sell_tax_10_100',
      'Sell Tax >= 10%',
      `Sell tax is ${sellTaxPercent.toFixed(2)}%.`,
    );
  }

  if (hasTransferPausable) {
    addWarning('transfer_pausable', 'Transfer Pausable', 'Owner can pause token transfers.');
  }

  if (hasProxyUpgradable) {
    addWarning(
      'proxy_upgradable',
      'Proxy / Upgradable',
      'Proxy contract with upgradeability controls detected.',
    );
  }

  if (!isOpenSource) {
    addWarning(
      'not_open_source',
      'Not Open Source',
      'Open-source contract verification not found.',
    );
  }

  // Trust signal badges
  const hasNormalTaxes =
    (buyTaxPercent === null || buyTaxPercent < LOW_TAX_THRESHOLD_PERCENT) &&
    (sellTaxPercent === null || sellTaxPercent < LOW_TAX_THRESHOLD_PERCENT);

  if (!hasHoneypot) {
    addTrust('no_honeypot', 'No Honeypot', 'No honeypot flag found.');
  }

  if (hasNormalTaxes) {
    addTrust('normal_taxes', 'Normal Taxes', `Buy/sell tax is below ${LOW_TAX_THRESHOLD_PERCENT}%.`);
  }

  if (!hasHiddenOwner && !hasMintable) {
    addTrust('owner_mint_risk_clear', 'No Hidden/Mint Risk', 'No hidden owner or mintable risk detected.');
  }

  if (isOwnerRenounced) {
    addTrust('ownership_renounced', 'Ownership Renounced', 'Contract ownership has been renounced or burned.');
  }

  if (isOpenSource) {
    addTrust('open_source', 'Open Source', 'Contract is open source.');
  }

  return {
    criticalFlags: uniqueList(criticalFlags),
    warningFlags: uniqueList(warningFlags),
    reasons: uniqueList(reasons),
    badges,
  };
}

export function evaluateGoPlusRisk(risk: GoPlusRisk): RiskEvaluation {
  const assessment = assessGoPlusRisk(risk);

  if (assessment.criticalFlags.length > 0) {
    return {
      decision: 'BLOCK',
      securityLevel: SECURITY_LEVEL_BY_DECISION['BLOCK'],
      criticalFlags: assessment.criticalFlags,
      reasons: assessment.reasons,
      badges: assessment.badges,
    };
  }

  if (assessment.warningFlags.length > 0) {
    return {
      decision: 'WARN',
      securityLevel: SECURITY_LEVEL_BY_DECISION['WARN'],
      criticalFlags: assessment.criticalFlags,
      reasons: assessment.reasons,
      badges: assessment.badges,
    };
  }

  return {
    decision: 'ALLOW',
    securityLevel: SECURITY_LEVEL_BY_DECISION['ALLOW'],
    criticalFlags: [],
    reasons: assessment.reasons,
    badges: assessment.badges,
  };
}

export function toAbriumTokenSecurity(evaluation: RiskEvaluation) {
  return {
    securityLevel: evaluation.securityLevel,
  };
}
