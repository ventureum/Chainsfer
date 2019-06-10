// @flow
import type { WalletData, AccountEthereum, AccountBitcoin, Account } from '../types/wallet.flow'

export default class WalletUtils {
  static toWalletData = (
    walletType: string,
    cryptoType: string,
    accounts: Array<Account>
  ): WalletData => {
    if (!accounts) accounts = []
    if (['ethereum', 'dai'].includes(cryptoType)) {
      if (accounts.length === 0) {
        accounts.push(this._normalizeAccountEthereum({}))
      }
      return {
        walletType,
        cryptoType,
        accounts: accounts.map(account =>
          this._normalizeAccountEthereum(((account: any): AccountEthereum))
        )
      }
    } else if (['bitcoin'].includes(cryptoType)) {
      if (accounts.length === 0) {
        accounts.push(this._normalizeAccountBitcoin({}))
      }
      return {
        walletType,
        cryptoType,
        accounts: accounts.map(account =>
          this._normalizeAccountBitcoin(((account: any): AccountBitcoin))
        )
      }
    } else {
      throw new Error(`Invalid cryptoType: ${cryptoType}`)
    }
  }

  static toWalletDataFromState = (walletType: string, cryptoType: string, walletState: any) => {
    return this.toWalletData(walletType, cryptoType, walletState.crypto[cryptoType])
  }

  static _normalizeAccountEthereum = (account: AccountEthereum): any => {
    let { balance, ethBalance, address, privateKey, encryptedPrivateKey } = account

    let _account: AccountEthereum = {
      balance: balance || '0',
      ethBalance: ethBalance || '0',
      address: address || '0x0',
      privateKey: privateKey,
      encryptedPrivateKey: encryptedPrivateKey
    }
    return _account
  }

  static _normalizeAccountBitcoin = (account: AccountBitcoin): any => {
    let { balance, address, privateKey, encryptedPrivateKey, hdWalletVariables } = account

    let _account: AccountBitcoin = {
      balance: balance || '0',
      address: address || '0x0',
      privateKey: privateKey,
      encryptedPrivateKey: encryptedPrivateKey,
      hdWalletVariables: hdWalletVariables || {
        xpub: '0x0',
        nextAddressIndex: 0,
        nextChangeIndex: 0,
        addresses: [],
        lastBlockHeight: 0,
        lastUpdate: 0
      }
    }
    return _account
  }
}
