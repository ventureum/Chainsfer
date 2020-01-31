export type Address = string

export type BackEndCryptoAccountType = {
  crytoType: string,
  walletType: string,
  address: ?string, // not used for btc account
  xpub: ?string, // not used for eth account
  name: string, // the name of this account set by the user.
  email: ?string, // coinbase oauth user eamil
  verified: boolean,
  receivable: boolean,
  sendable: boolean,
  addedAt: number, // timestamp, this is filled in by backend
  updatedAt: number // timestamp, this is filled in by backend
}

export type Utxos = Array<{
  value: number,
  script: string,
  outputIndex: number,
  txHash: string
}>

export type BitcoinAddress = {
  address: Address,
  path: string,
  utxos: Utxos
}
export type HDWalletVariables = {
  xpub: string,
  xpriv?: string,
  nextAddressIndex: number,
  nextChangeIndex: number,
  addresses: Array<BitcoinAddress>,
  lastUpdate: number,
  endAddressIndex: number,
  endChangeIndex: number
}

export const accountStatus = {
  synced: 'SYNCED',
  syncing: 'SYNCING',
  initialized: 'INITIALIZED',
  dirty: 'DIRTY'
}

export type BitcoinAccountData = {
  id: string,
  cryptoType: string,
  walletType: string,
  platformType: PlatformType,

  // address in hardware wallet is the next receiving address
  address: Address,
  name: String, // the name of this account set by the user.
  email: ?string, // coinbase oauth user eamil
  displayName: String, // `${name} (${walletType})`

  // token balance for erc20 tokens/
  balance: string,
  balanceInStandardUnit: string,

  // optional hd wallet variables
  hdWalletVariables: HDWalletVariables,

  connected: boolean, // true if connected
  verified: Boolean, // true if previously connected
  receivable: Boolean,
  sendable: Boolean,
  status: string,

  privateKey?: string,
  encryptedPrivateKey?: string,

  lastSynced: number // unix timestamp
}

export type EthereumAccountData = {
  id: string,
  cryptoType: string,
  walletType: string,
  platformType: PlatformType,

  address: Address,
  name: String, // the name of this account set by the user.
  email: ?string, // coinbase oauth user eamil
  displayName: String, // `${name} (${walletType})`

  // token balance for erc20 tokens/
  balance: string,
  balanceInStandardUnit: string,

  // eth balance only
  ethBalance: string,

  connected: boolean, // true if connected
  verified: Boolean, // true if previously connected
  receivable: Boolean,
  sendable: Boolean,
  status: string,

  // erc20 token allowance for the
  // multisig escrow wallet
  multiSigWalletAllowance: string,

  privateKey?: string,
  encryptedPrivateKey?: string,
  lastSynced: number // unix timestamp
}

export type AccountData = EthereumAccountData | BitcoinAccountData

export type PlatformType = 'bitcoin' | 'ethereum'

// This is intended to be used by account management component
// to group accounts that have the same address and same walletType
export type CategorizedAccount = {
  totalMarketValue: string,
  fiatCurrency: strign,

  assets: Array<accountData>,

  platformType: PlatformType,
  walletType: string,
  address: Address,
  status: accountStatus,
  name: string,
  id: string //  JSON.stringify({ address, walletType })
}

export interface IAccount<AccountData> {
  accountData: AccountData;

  constructor(account?: AccountData): void;
  clearPrivateKey(): void;
  getAccountData(): AccountData;
  encryptAccount(password: string): Promise<void>;
  decryptAccount(password: string): Promise<void>;
  syncWithNetwork(): Promise<void>;
}
