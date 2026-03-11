import { AppDataSource } from '../db/dataSource.js'
import { User } from '../entities/User.js'
import { UserWallet } from '../entities/UserWallet.js'

export type UserWalletInfo = {
  walletAddress: string
  chain: string | null
  provider: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export type UserInfo = {
  dynamicUserId: string
  email: string | null
  walletAddress: string | null
  authProvider: string | null
  isVerified: boolean
  wealthTier: number
  isDeleted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  wallets: UserWalletInfo[]
}

export async function getUserInfoByWalletAddress(
  walletAddress: string,
): Promise<UserInfo | null> {
  const normalizedWalletAddress = walletAddress.toLowerCase()

  const userRepository = AppDataSource.getRepository(User)
  const userWalletRepository = AppDataSource.getRepository(UserWallet)

  let user = await userRepository
    .createQueryBuilder('user')
    .where('lower(user.wallet_address) = :walletAddress', {
      walletAddress: normalizedWalletAddress,
    })
    .getOne()

  if (!user) {
    const walletRecord = await userWalletRepository
      .createQueryBuilder('wallet')
      .where('lower(wallet.wallet_address) = :walletAddress', {
        walletAddress: normalizedWalletAddress,
      })
      .getOne()

    if (walletRecord) {
      user = await userRepository.findOne({
        where: { dynamicUserId: walletRecord.dynamicUserId },
      })
    }
  }

  if (!user) {
    return null
  }

  const wallets = await userWalletRepository.find({
    where: { dynamicUserId: user.dynamicUserId },
    order: { isPrimary: 'DESC', createdAt: 'ASC' },
  })

  return {
    dynamicUserId: user.dynamicUserId,
    email: user.email,
    walletAddress: user.walletAddress,
    authProvider: user.authProvider,
    isVerified: user.isVerified,
    wealthTier: user.wealthTier,
    isDeleted: user.isDeleted,
    deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    wallets: wallets.map((wallet) => ({
      walletAddress: wallet.walletAddress,
      chain: wallet.chain,
      provider: wallet.provider,
      isPrimary: wallet.isPrimary,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt.toISOString(),
    })),
  }
}
