import { env } from '../config/env.js';

type GoPlusRiskPayload = Record<string, unknown>;

type GoPlusResponse = {
  code?: number | string;
  message?: string;
  result?: Record<string, GoPlusRiskPayload> | null;
};

const GOPLUS_CODE_MESSAGES: Record<number, string> = {
  1: 'Complete data prepared',
  2: 'Partial data obtained. Retry in about 15 seconds for full data.',
  2004: 'Contract address format error',
  2018: 'ChainID not supported',
  2020: 'Non-contract address',
  2021: 'No info for this contract',
  2022: 'Non-supported chainId',
  2026: 'dApp not found',
  2027: 'ABI not found',
  2028: 'ABI does not support parsing',
  4010: 'App key not found',
  4011: 'Signature expired or replayed request',
  4012: 'Wrong signature',
  4023: 'Access token not found',
  4029: 'Request limit reached',
  5000: 'System error',
  5006: 'Parameter error',
};

function normalizeGoPlusCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getGoPlusKnownMessage(code: number) {
  return GOPLUS_CODE_MESSAGES[code] ?? null;
}

function normalizeGoPlusMessage(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export class GoPlusApiError extends Error {
  code: number | null;
  providerMessage: string | null;

  constructor(params: {
    message: string;
    code?: number | null;
    providerMessage?: string | null;
  }) {
    super(params.message);
    this.name = 'GoPlusApiError';
    this.code = params.code ?? null;
    this.providerMessage = params.providerMessage ?? null;
  }
}

function buildGoPlusError(input: {
  code: number | null;
  providerMessage: string | null;
  fallback: string;
}) {
  const knownMessage =
    input.code === null ? null : getGoPlusKnownMessage(input.code);
  const providerMessage = input.providerMessage ?? knownMessage;
  const message =
    input.code === null
      ? providerMessage ?? input.fallback
      : `GoPlus error ${input.code}: ${providerMessage ?? input.fallback}`;

  return new GoPlusApiError({
    message,
    code: input.code,
    providerMessage,
  });
}

export async function fetchGoPlusTokenSecurity(params: {
  chainId: number;
  tokenAddress: string;
}): Promise<GoPlusRiskPayload> {
  const normalizedAddress = params.tokenAddress.toLowerCase();
  const query = new URLSearchParams({ contract_addresses: normalizedAddress });
  const url = `${env.GOPLUS_BASE_URL}/${params.chainId}?${query.toString()}`;
  const response = await fetch(url);
  const data = (await response.json().catch(() => null)) as GoPlusResponse | null;
  const code = normalizeGoPlusCode(data?.code);
  const providerMessage = normalizeGoPlusMessage(data?.message);

  if (!response.ok) {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: `GoPlus request failed with status ${response.status}`,
    });
  }

  if (!data || typeof data !== 'object') {
    throw new GoPlusApiError({
      message: 'GoPlus returned an invalid response payload',
    });
  }

  // 1 = complete payload. 2 = partial payload; avoid trusting partial risk output.
  if (code !== null && code !== 1) {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: 'GoPlus did not return complete token risk data',
    });
  }

  const result =
    data.result?.[normalizedAddress] ??
    data.result?.[params.tokenAddress] ??
    null;

  if (!result) {
    throw buildGoPlusError({
      code,
      providerMessage,
      fallback: 'GoPlus did not return token risk data',
    });
  }

  return result;
}
