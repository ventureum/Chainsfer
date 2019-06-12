// @flow
import url from '../url'
import env from '../typedEnv'
import API from '../apis'
import Web3 from 'web3'
import BN from 'bn.js'
import ERC20 from '../ERC20'
import LedgerNanoS from '../ledgerSigner'
import { networkIdMap } from '../ledgerSigner/utils'
import utils from '../utils'
import type { IWallet, WalletDataEthereum, AccountEthereum } from '../types/wallet.flow'
import type { TxFee, TxHash } from '../types/transfer.flow'
import type { BasicTokenUnit, Address } from '../types/token.flow'

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

  getWalletData = (): WalletDataEthereum => this.walletData

  generateWallet = async ({
    walletType,
    cryptoType
  }: {
    walletType: string,
    cryptoType: string
  }) => {
    this.walletData = {
      walletType: walletType,
      cryptoType: cryptoType,
      accounts: [await this.createAccount()]
    }
  }

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
      ethBalance: '0',
      address: web3Account.address,
      privateKey: web3Account.privateKey
    }

    return account
  }

  // get account (default first account)
  getAccount = (accountIdx?: number): AccountEthereum => {
    if (!accountIdx) accountIdx = 0
    return this.walletData.accounts[accountIdx]
  }

  encryptAccount = async (password: string) => {
    let accountIdx = 0
    if (!this.walletData.accounts[accountIdx].privateKey) {
      throw new Error('PrivateKey does not exist')
    }
    this.walletData.accounts[accountIdx].encryptedPrivateKey = await utils.encryptMessage(
      this.walletData.accounts[accountIdx].privateKey,
      password
    )
  }

  decryptAccount = async (password: string) => {
    let accountIdx = 0
    if (!this.walletData.accounts[accountIdx].encryptedPrivateKey) {
      throw new Error('EncryptedPrivateKey does not exist')
    }
    let privateKey = await utils.decryptMessage(
      this.walletData.accounts[accountIdx].encryptedPrivateKey,
      password
    )
    if (!privateKey) throw new Error('Incorrect password')
    this.walletData.accounts[accountIdx].privateKey = privateKey

    const _web3 = new Web3(new Web3.providers.HttpProvider(url.INFURA_API_URL))
    this.walletData.accounts[accountIdx].address = _web3.eth.accounts.privateKeyToAccount(privateKey).address
  }

  clearPrivateKey = (): void => {
    let accountIdx = 0
    this.walletData.accounts[accountIdx].privateKey = undefined
  }

  retrieveAddress = async (): Promise<void> => {
    let accountIdx = 0
    let { walletType } = this.walletData
    if (this.walletData.accounts.length === 0) {
      this.walletData.accounts.push({
        balance: '0',
        ethBalance: '0',
        address: '0x0'
      })
    }
    if (walletType === 'ledger') {
      // retrieve the first address from ledger
      this.walletData.accounts[accountIdx].address = await this.ledger.getEthAddress(accountIdx)
    } else if (walletType === 'metamask') {
      // retrieve the first address from metamask
      if (typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask) {
        if (
          window.ethereum.networkVersion !== networkIdMap[env.REACT_APP_ETHEREUM_NETWORK].toString()
        ) {
          throw 'Incorrect Metamask network' // eslint-disable-line
        }
        let addresses = await window.ethereum.enable()
        this.walletData.accounts[accountIdx].address = addresses[0]
      } else {
        throw new Error('Metamask not found')
      }
    } else {
      throw new Error(`Cannot retrieve address for walletType ${walletType}`)
    }
  }

  sync = async (progress: any) => {
    let _web3 = new Web3(new Web3.providers.HttpProvider(url.INFURA_API_URL))

    let { cryptoType } = this.walletData

    // use the first account only
    let account = this.walletData.accounts[0]

    // set eth balance
    account.ethBalance = await _web3.eth.getBalance(account.address)

    // set token balance
    if (['dai'].includes(cryptoType)) {
      account.balance = (await ERC20.getBalance(account.address, cryptoType)).toString()
    } else {
      // copy eth balance
      account.balance = account.ethBalance
    }
  }

  getTxFee = async ({ to, value }: { to?: string, value: BasicTokenUnit }): Promise<TxFee> => {
    let { cryptoType } = this.walletData

    const mockFrom = '0x0f3fe948d25ddf2f7e8212145cef84ac6f20d904'
    const mockTo = '0x0f3fe948d25ddf2f7e8212145cef84ac6f20d905'

    if (cryptoType === 'ethereum') {
      return utils.getGasCost({ from: mockFrom, to: mockTo, value: value })
    } else if (cryptoType === 'dai') {
      // special case for erc20 tokens
      // amount of eth to be transfered to the escrow wallet
      // this will be spent as tx fees for the next token transfer (from escrow wallet)
      // otherwise, the tokens in the escrow wallet cannot be transfered out
      // we use the current estimation to calculate amount of ETH to be transfered

      let txFeeERC20 = await utils.getGasCost(ERC20.getTransferTxObj(mockFrom, mockTo, value, cryptoType))

      // eth to be transfered for paying erc20 token tx while receiving
      let ethTransfer = txFeeERC20.costInBasicUnit
      let txFeeEth = await utils.getGasCost({ from: mockFrom, to: mockTo, value: value })

      // estimate total cost = eth to be transfered + eth transfer fee + erc20 transfer fee
      let totalCostInBasicUnit = new BN(txFeeEth.costInBasicUnit)
        .add(new BN(txFeeERC20.costInBasicUnit))
        .add(new BN(ethTransfer))
      
      let rv: TxFee = {
        // use the current estimated price
        price: txFeeERC20.price,
        // eth transfer gas + erc20 transfer gas
        gas: new BN(txFeeEth.gas).add(new BN(txFeeERC20.gas)).toString(),
        costInBasicUnit: totalCostInBasicUnit.toString(),
        costInStandardUnit: utils.toHumanReadableUnit(totalCostInBasicUnit).toString(),
        // subtotal tx cost
        // this is used for submitTx()
        costByType: { txFeeEth, txFeeERC20, ethTransfer }
      }
      return rv
    } else {
      throw new Error(`Invalid cryptoType: ${cryptoType}`)
    }
  }

  sendTransaction = async ({
    to,
    value,
    txFee,
    options
  }: {
    to: Address,
    value: BasicTokenUnit,
    txFee?: TxFee,
    options?: Object
  }): Promise<TxHash | Array<TxHash>> => {
    // helper function
    function web3SendTransactionPromise (web3Function: Function, txObj: Object) {
      return new Promise((resolve, reject) => {
        web3Function(txObj)
          .on('transactionHash', hash => resolve(hash))
          .on('error', error => reject(error))
      })
    }

    async function web3SendTransactions (web3Function: Function, txObjs: Array<Object>) {
      let txHashList = []
      for (let txObj of txObjs) {
        txHashList.push(await web3SendTransactionPromise(web3Function, txObj))
      }
      return txHashList.length === 1 ? txHashList[0] : txHashList
    }

    const _web3 = new Web3(new Web3.providers.HttpProvider(url.INFURA_API_URL))
    const account = this.getAccount()
    const { walletType, cryptoType } = this.walletData
    let txObjs: any = []

    if (!txFee) {
      txFee = await this.getTxFee({ to, value })
    }
    // setup tx obj
    if (cryptoType === 'ethereum') {
      txObjs.push({ from: account.address, to: to, value: value, gas: txFee.gas, gasPrice: txFee.price })
    } else if (cryptoType === 'dai') {
      let ERC20TxObj = await ERC20.getTransferTxObj(account.address, to, value, cryptoType)

      // set ERC20 tx gas
      if (txFee.costByType.txFeeERC20) {
        ERC20TxObj.gas = txFee.costByType.txFeeERC20.gas
        ERC20TxObj.gasPrice = txFee.costByType.txFeeERC20.price
      } else {
        throw new Error('txFeeERC20 not found in txFee')
      }
      
      if (options && options.prepayTxFee) {
        // need to prepay tx fee
        var txFeeEthTxObj = {
          from: account.address,
          to: to,
          value: txFee.costByType && txFee.costByType.ethTransfer,
          gas: txFee.costByType && txFee.costByType.txFeeEth.gas,
          gasPrice: txFee.costByType && txFee.costByType.txFeeEth.price,
          nonce: await _web3.eth.getTransactionCount(account.address)
        }
        // consecutive tx, need to set nonce manually
        ERC20TxObj.nonce = txFeeEthTxObj.nonce + 1
        txObjs.push(txFeeEthTxObj)
      }
      txObjs.push(ERC20TxObj)
    }

    if (walletType === 'metamask') {
      return web3SendTransactions(window._web3.eth.sendTransaction, txObjs)
    } else if (['drive', 'escrow'].includes(walletType)) {
      // add privateKey to web3
      _web3.eth.accounts.wallet.add(account.privateKey)
      return web3SendTransactions(_web3.eth.sendTransaction, txObjs)
    } else if (walletType === 'ledger') {
      const ledgerNanoS = new LedgerNanoS()
      let rawTxObjList = []
      for (let txObj of txObjs) {
        rawTxObjList.push((await ledgerNanoS.signSendTransaction(txObj)).rawTransaction)
      }
      return web3SendTransactions(
        _web3.eth.sendSignedTransaction,
        rawTxObjList
      )
    } else {
      throw new Error(`Invalid walletType: ${walletType}`)
    }
  }
}
