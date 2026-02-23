import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppDataSource, initializeDataSource } from '../db/dataSource.js';
import { User } from '../entities/User.js';
import { UserWallet } from '../entities/UserWallet.js';
import { WebhookEvent } from '../entities/WebhookEvent.js';
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

    await initializeDataSource();
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const userRepository = queryRunner.manager.getRepository(User);
      const userWalletRepository = queryRunner.manager.getRepository(UserWallet);

      const eventWrite = await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(WebhookEvent)
        .values({
          eventId,
          eventType,
          payload: parsed,
        })
        .onConflict(`("event_id") DO NOTHING`)
        .returning(['event_id'])
        .execute();

      const wasInserted =
        eventWrite.identifiers.length > 0 ||
        (Array.isArray(eventWrite.raw) && eventWrite.raw.length > 0);

      if (!wasInserted) {
        await queryRunner.commitTransaction();
        return successResponse(res, 'Webhook already processed', 200, {
          ok: true,
          duplicate: true,
        });
      }

      if (userData.dynamicUserId) {
        const walletAddress = userData.wallets[0]?.address ?? null;
        let nextEmail = userData.email;

        if (nextEmail) {
          const existingEmailOwner = await userRepository
            .createQueryBuilder('user')
            .select('user.dynamicUserId', 'dynamicUserId')
            .where('lower(user.email) = lower(:email)', { email: nextEmail })
            .limit(1)
            .getRawOne<{ dynamicUserId: string }>();

          const ownerDynamicUserId = existingEmailOwner?.dynamicUserId ?? null;

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

        const existingUser = await userRepository.findOne({
          where: { dynamicUserId: userData.dynamicUserId },
        });

        if (!existingUser) {
          await userRepository.save(
            userRepository.create({
              dynamicUserId: userData.dynamicUserId,
              email: nextEmail,
              walletAddress,
              authProvider: userData.authProvider,
              isDeleted: false,
              deletedAt: null,
            }),
          );
        } else {
          if (nextEmail !== null) {
            existingUser.email = nextEmail;
          }
          if (walletAddress !== null) {
            existingUser.walletAddress = walletAddress;
          }
          if (userData.authProvider !== null) {
            existingUser.authProvider = userData.authProvider;
          }
          existingUser.isDeleted = false;
          existingUser.deletedAt = null;
          existingUser.updatedAt = new Date();

          await userRepository.save(existingUser);
        }

        if (eventType.includes('user.deleted')) {
          await userRepository.update(
            { dynamicUserId: userData.dynamicUserId },
            {
              isDeleted: true,
              deletedAt: new Date(),
              updatedAt: new Date(),
            },
          );

          await userWalletRepository.delete({
            dynamicUserId: userData.dynamicUserId,
          });
        } else if (eventType.includes('wallet.unlinked')) {
          for (const wallet of userData.wallets) {
            await userWalletRepository.delete({
              dynamicUserId: userData.dynamicUserId,
              walletAddress: wallet.address,
            });
          }
        } else {
          for (const wallet of userData.wallets) {
            await userWalletRepository.upsert(
              {
                dynamicUserId: userData.dynamicUserId,
                walletAddress: wallet.address,
                chain: wallet.chain ?? null,
                provider: wallet.provider ?? null,
                isPrimary: wallet.isPrimary ?? false,
                updatedAt: new Date(),
              },
              ['dynamicUserId', 'walletAddress'],
            );
          }
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
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
