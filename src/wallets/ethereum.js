// @flow
import BN from 'bn.js'
import utils from '../utils'
import axios from 'axios'
import url from '../url'
import env from '../typedEnv'
import API from '../apis'
import Web3 from 'web3'
import ERC20 from '../ERC20'
import LedgerNanoS from '../ledgerSigner'

import type { IWallet, WalletDataEthereum, AccountEthereum } from '../types/wallet.flow'

import type { TxFee, TxHash, BasicTokenUnit } from '../types/transfer.flow'

export default class WalletEthereum implements IWallet<WalletDataEthereum, AccountEthereum> {
  ledger: any
  walletData: WalletDataEthereum

  constructor (walletData?: WalletDataEthereum) {
    if (walletData) {
      this.walletData = walletData
      if (this.walletData.walletType === 'ledger') {
        this.ledger = new LedgerNanoS()
      }
    }
  }

  // interface functions
  createAccount = async (): Promise<AccountEthereum> => {
    // we use the first address as the sending/change address
    let _web3 = new Web3(new Web3.providers.HttpProvider(url.INFURA_API_URL))
    let web3Account
    if (env.REACT_APP_PREFILLED_ACCOUNT_ENDPOINT) {
      const privateKey = await API.getPrefilledAccount()
      web3Account = privateKey
        ? _web3.eth.accounts.privateKeyToAccount(privateKey)
        : _web3.eth.accounts.create()
    } else {
      web3Account = _web3.eth.accounts.create()
    }

    let account = {
      balance: '0',
      address: web3Account.address,
      privateKey: web3Account.privateKey,
      encryptedPrivateKey: null
    }

    return account
  }

  getPrivateKey = (accountIdx?: number = 0): ?string => {
    if (this.walletData.walletType === 'drive') {
      return this.getAccount(accountIdx).privateKey
    }
    // no private keys avaiable
    return null
  }

  // get account (default first account)
  getAccount = (accountIdx?: number): AccountEthereum => {
    if (!accountIdx) accountIdx = 0
    return this.walletData.accounts[accountIdx]
  }

  getTxFee = async ({ to, value }: { to?: string, value: string }): Promise<TxFee> => {
    let { cryptoType } = this.walletData

    const mockFrom = '0x0f3fe948d25ddf2f7e8212145cef84ac6f20d904'
    const mockTo = '0x0f3fe948d25ddf2f7e8212145cef84ac6f20d905'

    if (cryptoType === 'ethereum') {
      return utils.getGasCost({ from: mockFrom, to: mockTo, value: value })
    } else if (cryptoType === 'dai') {
      return utils.getGasCost(ERC20.getTransferTxObj(mockFrom, mockTo, value, cryptoType))
    } else {
      throw new Error(`Invalid cryptoType: ${cryptoType}`)
    }
  }

  sendTransaction = async ({
    to,
    value,
    txFee
  }: {
    to: string,
    value: BasicTokenUnit,
    txFee?: TxFee
  }): Promise<TxHash> => {
    // helper function
    function web3EthSendTransactionPromise (web3Function: Function, txObj: Object) {
      return new Promise((resolve, reject) => {
        web3Function(txObj)
          .on('transactionHash', hash => resolve(hash))
          .on('error', error => reject(error))
      })
    }

    const account = this.getAccount()
    const ledgerNanoS = new LedgerNanoS()
    const { walletType, cryptoType } = this.walletData
    let txObj: any = {}
    // setup tx obj
    if (cryptoType === 'ethereum') {
      txObj = { from: account.address, to: to, value: value }
    } else if (cryptoType === 'dai') {
      txObj = await ERC20.getTransferTxObj(account.address, to, value, cryptoType)
    }

    if (!txFee) {
      txFee = await this.getTxFee({ to, value })
    }

    // setup tx fees
    txObj.gas = txFee.gas
    txObj.gasPrice = txFee.price

    if (walletType === 'metamask') {
      return web3EthSendTransactionPromise(window._web3.eth.sendTransaction, txObj)
    } else if (walletType === 'ledger') {
      let _web3 = new Web3(new Web3.providers.HttpProvider(url.INFURA_API_URL))
      const signedTransactionObject = await ledgerNanoS.signSendTransaction(txObj)
      return web3EthSendTransactionPromise(
        _web3.eth.sendSignedTransaction,
        signedTransactionObject.rawTransaction
      )
    } else {
      throw new Error(`Invalid walletType: ${walletType}`)
    }
  }
}
