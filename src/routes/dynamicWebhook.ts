import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import {
  errorResponse,
  failResponse,
  successResponse,
} from '../utils/response.js';

type WalletLike = {
  address: string;
  chain?: string | null;
  provider?: string | null;
  isPrimary?: boolean;
};

function normalizeSignature(signatureHeader: string | undefined) {
  if (!signatureHeader) return null;
  const value = signatureHeader.split(',')[0]?.trim() ?? '';
  return value.startsWith('sha256=') ? value.slice('sha256='.length) : value;
}

function verifySignature(rawBody: string, signatureHeader: string | undefined) {
  const secret = env.DYNAMIC_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('DYNAMIC_WEBHOOK_SECRET is not configured');
  }

  const received = normalizeSignature(signatureHeader);
  if (!received) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(received, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function getStringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeWalletAddress(value: unknown) {
  const address = getStringValue(value);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return null;
  }
  return address.toLowerCase();
}

function extractEventType(payload: Record<string, unknown>) {
  const direct =
    getStringValue(payload.type) ?? getStringValue(payload.eventName);
  if (direct) return direct;

  const nestedEvent = payload.event;
  if (nestedEvent && typeof nestedEvent === 'object') {
    const typed = nestedEvent as Record<string, unknown>;
    return (
      getStringValue(typed.type) ?? getStringValue(typed.name) ?? 'unknown'
    );
  }

  return 'unknown';
}

function extractEventId(payload: Record<string, unknown>, rawBody: string) {
  const eventId =
    getStringValue(payload.id) ??
    getStringValue(payload.eventId) ??
    getStringValue(payload.messageId);

  if (eventId) return eventId;

  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

function extractUserData(payload: Record<string, unknown>) {
  const data = (payload.data as Record<string, unknown> | undefined) ?? payload;
  const user =
    data.user && typeof data.user === 'object'
      ? (data.user as Record<string, unknown>)
      : null;

  const dynamicUserId =
    getStringValue(payload.userId) ??
    getStringValue(data.userId) ??
    (user ? getStringValue(user.id) : null) ??
    getStringValue(payload.subject) ??
    getStringValue(data.subject);

  const email =
    getStringValue(data.email) ?? (user ? getStringValue(user.email) : null);

  const walletCandidates: WalletLike[] = [];

  const wallets = data.wallets;
  if (Array.isArray(wallets)) {
    for (const entry of wallets) {
      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        const address = normalizeWalletAddress(item.address);
        if (!address) continue;
        walletCandidates.push({
          address,
          chain: getStringValue(item.chain) ?? getStringValue(item.chainName),
          provider:
            getStringValue(item.walletProvider) ??
            getStringValue(item.provider),
          isPrimary: item.isPrimary === true,
        });
      }
    }
  }

  const verifiedCredentials = data.verifiedCredentials;
  if (Array.isArray(verifiedCredentials)) {
    for (const entry of verifiedCredentials) {
      if (entry && typeof entry === 'object') {
        const item = entry as Record<string, unknown>;
        const address = normalizeWalletAddress(item.address);
        if (!address) continue;
        walletCandidates.push({
          address,
          chain: getStringValue(item.chain),
          provider:
            getStringValue(item.walletName) ?? getStringValue(item.provider),
          isPrimary: false,
        });
      }
    }
  }

  const singleWallet = normalizeWalletAddress(data.walletAddress);
  if (singleWallet) {
    walletCandidates.push({
      address: singleWallet,
      chain: getStringValue(data.chain),
      provider: getStringValue(data.provider),
      isPrimary: false,
    });
  }

  const walletPublicKey = normalizeWalletAddress(data.walletPublicKey);
  if (walletPublicKey) {
    walletCandidates.push({
      address: walletPublicKey,
      chain: getStringValue(data.chain),
      provider:
        getStringValue(data.walletName) ??
        getStringValue(data.walletBookName) ??
        getStringValue(data.provider),
      isPrimary: false,
    });
  }

  const linkedWalletPublicKey =
    normalizeWalletAddress(data.lowerPublicKey) ??
    normalizeWalletAddress(data.publicKey);
  if (linkedWalletPublicKey) {
    walletCandidates.push({
      address: linkedWalletPublicKey,
      chain: getStringValue(data.chain),
      provider:
        getStringValue(data.walletBookName) ??
        getStringValue(data.name) ??
        getStringValue(data.provider),
      isPrimary: false,
    });
  }

  const uniqueWallets = new Map<string, WalletLike>();
  for (const wallet of walletCandidates) {
    uniqueWallets.set(wallet.address, wallet);
  }

  const orderedWallets = Array.from(uniqueWallets.values());
  const authProvider =
    orderedWallets.find((wallet) => wallet.provider)?.provider ??
    getStringValue(data.provider);

  return {
    dynamicUserId,
    email,
    wallets: orderedWallets,
    authProvider,
  };
}

export async function handleDynamicWebhook(req: Request, res: Response) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return failResponse(res, 'Expected raw request body', 400);
    }

    const rawBody = req.body.toString('utf8');
    const isValidSignature = verifySignature(
      rawBody,
      req.header('x-dynamic-signature-256') ?? undefined,
    );

    if (!isValidSignature) {
      return failResponse(res, 'Invalid webhook signature', 401);
    }

    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = extractEventType(parsed);
    const eventId = extractEventId(parsed, rawBody);
    const userData = extractUserData(parsed);
    // eslint-disable-next-line no-console
    console.info('Dynamic webhook event received', {
      eventType,
      eventId,
      dynamicUserId: userData.dynamicUserId,
    });

    const client = await pool.connect();
    try {
      await client.query('begin');

      const eventWrite = await client.query<{ event_id: string }>(
        `
        insert into webhook_events (event_id, event_type, payload)
        values ($1, $2, $3::jsonb)
        on conflict (event_id) do nothing
        returning event_id
        `,
        [eventId, eventType, JSON.stringify(parsed)],
      );

      if (eventWrite.rowCount === 0) {
        await client.query('commit');
        return successResponse(res, 'Webhook already processed', 200, {
          ok: true,
          duplicate: true,
        });
      }

      if (userData.dynamicUserId) {
        const walletAddress = userData.wallets[0]?.address ?? null;
        let nextEmail = userData.email;

        if (nextEmail) {
          const existingEmailOwner = await client.query<{ dynamic_user_id: string }>(
            `
            select dynamic_user_id
            from users
            where lower(email) = lower($1)
            limit 1
            `,
            [nextEmail],
          );

          const ownerDynamicUserId =
            existingEmailOwner.rows[0]?.dynamic_user_id ?? null;

          if (
            ownerDynamicUserId &&
            ownerDynamicUserId !== userData.dynamicUserId
          ) {
            // Preserve the existing unique email mapping and continue syncing wallets.
            console.warn(
              'Dynamic webhook email conflict detected; skipping email update',
              {
                eventId,
                email: nextEmail,
                dynamicUserId: userData.dynamicUserId,
                ownerDynamicUserId,
              },
            );
            nextEmail = null;
          }
        }

        const existingUser = await client.query<{ dynamic_user_id: string }>(
          `
          select dynamic_user_id
          from users
          where dynamic_user_id = $1
          limit 1
          `,
          [userData.dynamicUserId],
        );

        if (existingUser.rowCount === 0) {
          await client.query(
            `
            insert into users (
              dynamic_user_id,
              email,
              wallet_address,
              auth_provider,
              is_deleted,
              deleted_at
            ) values ($1, $2, $3, $4, false, null)
            on conflict (dynamic_user_id)
            do update set
              email = coalesce(excluded.email, users.email),
              wallet_address = coalesce(excluded.wallet_address, users.wallet_address),
              auth_provider = coalesce(excluded.auth_provider, users.auth_provider),
              is_deleted = false,
              deleted_at = null,
              updated_at = now()
            `,
            [
              userData.dynamicUserId,
              nextEmail,
              walletAddress,
              userData.authProvider,
            ],
          );
        } else {
          await client.query(
            `
            update users
            set
              email = coalesce($2, users.email),
              wallet_address = coalesce($3, users.wallet_address),
              auth_provider = coalesce($4, users.auth_provider),
              is_deleted = false,
              deleted_at = null,
              updated_at = now()
            where dynamic_user_id = $1
            `,
            [
              userData.dynamicUserId,
              nextEmail,
              walletAddress,
              userData.authProvider,
            ],
          );
        }

        if (eventType.includes('user.deleted')) {


          await client.query(
            `
            update users
            set is_deleted = true, deleted_at = now(), updated_at = now()
            where dynamic_user_id = $1
            `,
            [userData.dynamicUserId],
          );

          await client.query(
            `delete from user_wallets where dynamic_user_id = $1`,
            [userData.dynamicUserId],
          );
        } else if (eventType.includes('wallet.unlinked')) {
          for (const wallet of userData.wallets) {
            await client.query(
              `
              delete from user_wallets
              where dynamic_user_id = $1 and wallet_address = $2
              `,
              [userData.dynamicUserId, wallet.address],
            );
          }
        } else {
          for (const wallet of userData.wallets) {
            await client.query(
              `
              insert into user_wallets (
                dynamic_user_id,
                wallet_address,
                chain,
                provider,
                is_primary
              ) values ($1, $2, $3, $4, $5)
              on conflict (dynamic_user_id, wallet_address)
              do update set
                chain = excluded.chain,
                provider = excluded.provider,
                is_primary = excluded.is_primary,
                updated_at = now()
              `,
              [
                userData.dynamicUserId,
                wallet.address,
                wallet.chain ?? null,
                wallet.provider ?? null,
                wallet.isPrimary ?? false,
              ],
            );
          }
        }
      }

      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }

    return successResponse(res, 'Webhook processed successfully', 200, {
      ok: true,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Dynamic webhook processing failed', error);
    return errorResponse(res, 'Webhook processing failed', 500);
  }
}
