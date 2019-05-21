// @flow
import 'babel-polyfill'
import WebUsbTransport from '@ledgerhq/hw-transport-webusb' // for browser
import Ledger from '@ledgerhq/hw-app-eth'
import EthTx from 'ethereumjs-tx'
import Web3 from 'web3'
import {
  getSignTransactionObject,
  getBufferFromHex,
  calculateChainIdFromV,
  networkIdMap
} from './utils'
import BtcLedger from '@ledgerhq/hw-app-btc'
import { address, networks } from 'bitcoinjs-lib'
import axios from 'axios'
import moment from 'moment'
import ERC20 from '../ERC20'
import BN from 'bn.js'
import { getBtcLastBlockHeight } from '../utils'
import { getAccountXPub, findAddress } from './addressFinderUtils'
import url from '../url'
import env from '../typedEnv'

const baseEtherPath = "44'/60'/0'/0"
const baseBtcPath = env.REACT_APP_BTC_PATH

let networkId: number = networkIdMap[env.REACT_APP_ETHEREUM_NETWORK]

class LedgerNanoS {
  static webUsbTransport: any
  ethLedger: any
  web3: any
  btcLedger: any

  getWebUsbTransport = async (): Promise<any> => {
    if (!LedgerNanoS.webUsbTransport || !LedgerNanoS.webUsbTransport.device || !LedgerNanoS.webUsbTransport.device.opened) {
      LedgerNanoS.webUsbTransport = await WebUsbTransport.create()
      LedgerNanoS.webUsbTransport.setExchangeTimeout(300000) // 5 mins
      setTimeout(async () => {
        await LedgerNanoS.webUsbTransport.close()
        LedgerNanoS.webUsbTransport = null
      }, 300000)
    }
    return LedgerNanoS.webUsbTransport
  }

  getEtherLedger = async (): Promise<any> => {
    this.ethLedger = new Ledger(await this.getWebUsbTransport())
    return this.ethLedger
  }

  getWeb3 = (): any => {
    if (!this.web3) {
      this.web3 = new Web3(new Web3.providers.HttpProvider(url.INFURA_API_URL))
    }
    return this.web3
  }

  getEthAddress = async (accountIndex: number): Promise<string> => {
    const accountPath = baseEtherPath + `/${accountIndex}`
    const ethLedger = await this.getEtherLedger()
    const result = await ethLedger.getAddress(accountPath)
    return result.address
  }

  getBtcAddresss = async (accountIndex: number): Promise<Object> => {
    const btcLedger = await this.getBtcLedger()
    const accountPath = `${baseBtcPath}/${accountIndex}'/0/0`
    const addr = await btcLedger.getWalletPublicKey(accountPath, false, true)
    return addr
  }

  getBtcLedger = async (): Promise<any> => {
    this.btcLedger = new BtcLedger(await this.getWebUsbTransport())
    return this.btcLedger
  }

  syncAccountBaseOnCryptoType = async (cryptoType: string, accountIndex: number = 0, progress: Function): Promise<Object> => {
    let address: string
    let web3: any
    let balance: string
    switch (cryptoType) {
      case 'ethereum':
        address = await this.getEthAddress(accountIndex)
        web3 = this.getWeb3()
        balance = await web3.eth.getBalance(address)
        return {
          [cryptoType]: {
            [accountIndex]: {
              address: address,
              balance: balance
            }
          }
        }
      case 'dai':
        address = await this.getEthAddress(accountIndex)
        web3 = this.getWeb3()
        balance = await web3.eth.getBalance(address)
        return {
          [cryptoType]: {
            [accountIndex]: {
              address: address,
              balance: await ERC20.getBalance(address, cryptoType)
            }
          },
          ethereum: {
            [accountIndex]: {
              address: address,
              balance: balance
            }
          }
        }
      case 'bitcoin':
        return {
          [cryptoType]: {
            [accountIndex]: await this.syncBtcAccountInfo(accountIndex, progress)
          }
        }
      default:
        throw new Error('Ledger Wallet received invalid cryptoType')
    }
  }

  deviceConnected = async (cryptoType: string) => {
    try {
      if (cryptoType !== 'bitcoin') {
        await this.getEthAddress(0)
      } else {
        await this.getBtcAddresss(0)
      }
      return {
        connected: true,
        network: cryptoType === 'bitcoin' ? process.env.REACT_APP_BTC_NETWORK : networkId
      }
    } catch (e) {
      console.log(e)
      return {
        connected: false
      }
    }
  }

  /**
   * @param {number}      accountIndex        Index of sender account.
   * @param {string}      receipientAddr      Address of receipient.
   * @param {number}      amount              Amount of ether, in 'wei'.
   * @param {object}      options             Options of the transaction (i.e. gasLimit & gasPrice)
   */
  signSendEther = async (accountIndex: number, receipientAddr: string, amount: string, ...options: Array<any>) => {
    const accountPath = baseEtherPath + `/${accountIndex}`
    const web3 = this.getWeb3()
    const ethLedger = await this.getEtherLedger()
    const address = await this.getEthAddress(accountIndex)
    const txCount = await web3.eth.getTransactionCount(address)

    let gasPrice = web3.utils.toWei('20', 'Gwei') // default
    let gasLimit

    if (options[options.length - 1] && options[options.length - 1].gasPrice) {
      gasPrice = options[options.length - 1].gasPrice
    }
    if (options[options.length - 1] && options[options.length - 1].gasLimit) {
      gasLimit = options[options.length - 1].gasLimit
    }

    let rawTx = {
      from: address,
      nonce: txCount,
      gasPrice: web3.utils.numberToHex(gasPrice),
      to: receipientAddr,
      value: web3.utils.numberToHex(amount),
      data: ''
    }
    const gasNeeded = await web3.eth.estimateGas(rawTx)

    if (gasLimit === undefined) {
      gasLimit = gasNeeded
    } else if (new BN(gasNeeded).gt(new BN(gasLimit))) {
      console.error('Insufficient gas.')
    }

    rawTx = {
      ...rawTx,
      gas: web3.utils.numberToHex(gasLimit)
    }

    let tx = new EthTx(rawTx)
    tx.raw[6] = Buffer.from([networkId])
    tx.raw[7] = Buffer.from([])
    tx.raw[8] = Buffer.from([])

    const rv = await ethLedger.signTransaction(
      accountPath,
      tx.serialize().toString('hex')
    )
    tx.v = getBufferFromHex(rv.v)
    tx.r = getBufferFromHex(rv.r)
    tx.s = getBufferFromHex(rv.s)

    const signedChainId = calculateChainIdFromV(tx.v)
    if (signedChainId !== networkId) {
      console.error(
        'Invalid networkId signature returned. Expected: ' +
        networkId +
        ', Got: ' +
        signedChainId,
        'InvalidNetworkId'
      )
    }

    const signedTransactionObject = getSignTransactionObject(tx)

    return signedTransactionObject
    // return web3.eth.sendSignedTransaction(signedTransactionObject.rawTransaction)
  }

  signSendTransaction = async (txObj: any) => {
    const web3 = this.getWeb3()
    const ethLedger = await this.getEtherLedger()
    const accountIndex = 0 // default first account
    const accountPath = baseEtherPath + `/${accountIndex}`

    txObj.txCount = await web3.eth.getTransactionCount(txObj.from)

    let tx = new EthTx(txObj)
    tx.raw[6] = Buffer.from([networkId])
    tx.raw[7] = Buffer.from([])
    tx.raw[8] = Buffer.from([])

    const rv = await ethLedger.signTransaction(
      accountPath,
      tx.serialize().toString('hex')
    )
    tx.v = getBufferFromHex(rv.v)
    tx.r = getBufferFromHex(rv.r)
    tx.s = getBufferFromHex(rv.s)

    const signedChainId = calculateChainIdFromV(tx.v)
    if (signedChainId !== networkId) {
      console.error(
        'Invalid networkId signature returned. Expected: ' +
        networkId +
        ', Got: ' +
        signedChainId,
        'InvalidNetworkId'
      )
    }

    const signedTransactionObject = getSignTransactionObject(tx)
    return signedTransactionObject
  }

  /**
   * @param {number}                        accountIndex        Index of sender account.
   * @param {string}                        contractAddress     Target contract address.
   * @param {object}                        contractAbi         Contract ABI.
   * @param {string}                        methodName          Name of the method being called.
   * @param {[param1[, param2[, ...]]]}     params              Paramaters for the contract. The last param is a optional object contains gasPrice and gasLimit.
   */
  signSendTrasactionContract = async (accountIndex: number, contractAddress: string, contractAbi: Object, methodName: string, ...params: Array<any>) => {
    const accountPath = baseEtherPath + `/${accountIndex}`
    const web3 = this.getWeb3()
    const ethLedger = await this.getEtherLedger()
    const address = await this.getEthAddress(accountIndex)
    const txCount = await web3.eth.getTransactionCount(address)

    let gasPrice = web3.utils.toWei('20', 'Gwei') // default
    let gasLimit

    if (params[params.length - 1] && params[params.length - 1].gasPrice) {
      gasPrice = params[params.length - 1].gasPrice
    }
    if (params[params.length - 1] && params[params.length - 1].gasLimit) {
      gasLimit = params[params.length - 1].gasLimit
    }

    let functionParams = []
    if (['undefined', 'object'].indexOf(typeof params[params.length - 1]) >= 0 && params.length === 1) {
      console.log('no param')
    } else {
      params.forEach((item) => {
        if (['undefined', 'object'].indexOf(typeof item) < 0) {
          functionParams.push(item)
        }
      })
    }

    const targetContract = new web3.eth.Contract(contractAbi, contractAddress)
    const data = targetContract.methods[methodName](...functionParams).encodeABI()
    const gasNeeded = await targetContract.methods[methodName](...functionParams).estimateGas({ from: address })

    if (gasLimit === undefined) {
      gasLimit = gasNeeded
    } else if (new BN(gasNeeded).gt(new BN(gasLimit))) {
      console.error('Insufficient gas.')
    }

    let rawTx = {
      from: address,
      nonce: txCount + 1,
      gasPrice: web3.utils.numberToHex(gasPrice),
      gas: web3.utils.numberToHex(gasLimit),
      to: contractAddress,
      value: web3.utils.numberToHex(0),
      data: data
    }

    let tx = new EthTx(rawTx)
    tx.raw[6] = Buffer.from([networkId])
    tx.raw[7] = Buffer.from([])
    tx.raw[8] = Buffer.from([])

    const rv = await ethLedger.signTransaction(
      accountPath,
      tx.serialize().toString('hex')
    )
    tx.v = getBufferFromHex(rv.v)
    tx.r = getBufferFromHex(rv.r)
    tx.s = getBufferFromHex(rv.s)

    const signedChainId = calculateChainIdFromV(tx.v)
    if (signedChainId !== networkId) {
      console.error(
        'Invalid networkId signature returned. Expected: ' +
        networkId +
        ', Got: ' +
        signedChainId,
        'InvalidNetworkId'
      )
    }

    const signedTransactionObject = getSignTransactionObject(tx)
    return signedTransactionObject
  }

  callMethod = async (contractAddress: string, contractAbi: Object, methodName: string, ...params: Array<any>) => {
    let functionParams = []
    if (['undefined', 'object'].indexOf(typeof params[params.length - 1]) >= 0) {
      console.log('no param')
    } else {
      params.forEach((item) => {
        if (['undefined', 'object'].indexOf(typeof item)) {
          functionParams.push(item)
        }
      })
    }
    const web3 = this.getWeb3()
    const targetContract = new web3.eth.Contract(contractAbi, contractAddress)
    const rv = await targetContract.methods[methodName](...functionParams).call()
    return rv
  }

  getUtxoDetails = async (txHash: string) => {
    const details = await axios.get(`${url.LEDGER_API_URL}/transactions/${txHash}/hex`)
    return details.data[0].hex
  }

  createNewBtcPaymentTransaction = async (inputs: Array<Object>, to: string, amount: number, fee: number, changeIndex: number) => {
    const btcLedger = await this.getBtcLedger()
    const changeAddressPath = `${baseBtcPath}/0'/1/${changeIndex}`

    let associatedKeysets = []
    let finalInputs = []
    let inputValueTotal = 0
    for (let i = 0; i < inputs.length; i++) {
      const utxo = inputs[i]
      const utxoDetails = await this.getUtxoDetails(utxo.txHash)

      const txObj = btcLedger.splitTransaction(utxoDetails, true)
      const input = [txObj, utxo.outputIndex]
      finalInputs.push(input)
      associatedKeysets.push(utxo.keyPath)
      inputValueTotal += utxo.value
    }
    let outputs = []
    let amountBuffer = Buffer.alloc(8, 0)
    amountBuffer.writeUIntLE(amount, 0, 8)
    const txOutput = {
      amount: amountBuffer,
      script: address.toOutputScript(to, networks[env.REACT_APP_BITCOIN_JS_LIB_NETWORK])
    }
    outputs.push(txOutput)
    const change = inputValueTotal - amount - fee // 138 bytes for 1 input, 64 bytes per additional input

    let changeBuffer = Buffer.alloc(8, 0)
    changeBuffer.writeUIntLE(change, 0, 8)
    const changeAddress = (await btcLedger.getWalletPublicKey(changeAddressPath, false, true)).bitcoinAddress
    const changeOutput = {
      amount: changeBuffer,
      script: address.toOutputScript(changeAddress, networks[env.REACT_APP_BITCOIN_JS_LIB_NETWORK])
    }
    outputs.push(changeOutput)

    const outputScriptHex = btcLedger.serializeTransactionOutputs({ outputs: outputs }).toString('hex')
    const signedTxRaw = await btcLedger.createPaymentTransactionNew(
      finalInputs,
      associatedKeysets,
      changeAddressPath,
      outputScriptHex,
      undefined,
      undefined,
      true
    )

    return signedTxRaw
  }

  broadcastBtcRawTx = async (txRaw: string) => {
    const rv = await axios.post(
      `${url.LEDGER_API_URL}/transactions/send`,
      { tx: txRaw })
    return rv.data.result
  }

  getUtxosFromTxs = (txs: Array<Object>, address: string) => {
    let utxos = []
    let spent = {}
    txs.forEach(tx => {
      tx.inputs.forEach(input => {
        if (input.address === address) {
          if (!spent[input.output_hash]) {
            spent[input.output_hash] = {}
          }
          spent[input.output_hash][input.output_index] = true
        }
      })
    })
    txs.forEach(tx => {
      tx.outputs.forEach(output => {
        if (output.address === address) {
          if (!spent[tx.hash]) {
            spent[tx.hash] = {}
          }
          if (!spent[tx.hash][output.output_index]) {
            utxos.push({
              txHash: tx.hash,
              outputIndex: output.output_index,
              value: output.value,
              script: output.script_hex
            })
          }
        }
      })
    })

    return utxos
  }

  discoverAddress = async (xpub: string, accountIndex: number, change: number, offset: number, progress: ?Function): Object => {
    let gap = 0
    let addresses = []
    let balance = new BN(0)
    let nextAddress
    let i = offset
    let cuurentIndex = offset === 0 ? 0 : offset - 1
    while (gap < 5) {
      let address
      const addressPath = `${baseBtcPath}/${accountIndex}'/${change}/${i}`
      const bitcoinAddress = await findAddress(addressPath, true, xpub)

      const addressData = (await axios.get(`${url.LEDGER_API_URL}/addresses/${bitcoinAddress}/transactions?noToken=true&truncated=true`)).data
      if (addressData.txs.length === 0) {
        if (!nextAddress) nextAddress = bitcoinAddress
        gap += 1
      } else {
        cuurentIndex = i
        gap = 0
        let utxos = this.getUtxosFromTxs(addressData.txs, bitcoinAddress)
        let value = utxos.reduce((accu, utxo) => {
          return new BN(utxo.value).add(accu)
        }, new BN(0))
        balance = balance.add(value)
        address = {
          path: addressPath,
          publicKeyInfo: { bitcoinAddress },
          utxos: utxos
        }
        addresses.push(address)
      }
      if (progress) {
        progress(i, change)
      }
      i += 1
    }
    return {
      balance: balance.toString(),
      nextIndex: cuurentIndex + 1,
      addresses,
      nextAddress
    }
  }

  syncBtcAccountInfo = async (accountIndex: number, progress: ?Function): Object => {
    const btcLedger = await this.getBtcLedger()
    const xpub = await getAccountXPub(btcLedger, baseBtcPath, `${accountIndex}'`, true)

    const externalAddressData = await this.discoverAddress(xpub, accountIndex, 0, 0, progress)
    const internalAddressData = await this.discoverAddress(xpub, accountIndex, 1, 0, progress)

    let accountData = {
      balance: (new BN(externalAddressData.balance).add(new BN(internalAddressData.balance))).toString(),
      nextAddressIndex: externalAddressData.nextIndex,
      address: externalAddressData.nextAddress, // address for receiving
      nextChangeIndex: internalAddressData.nextIndex,
      changeAddress: internalAddressData.nextAddress,
      addresses: [...externalAddressData.addresses, ...internalAddressData.addresses],
      lastBlockHeight: await getBtcLastBlockHeight(),
      lastUpdate: moment().unix(),
      xpub
    }
    return accountData
  }

  updateBtcAccountInfo = async (accountIndex: number = 0, accountInfo: Object, xpub: string, progress: ?Function) => {
    const targetAccountInfo = accountInfo[accountIndex]
    let { nextAddressIndex, nextChangeIndex, addresses } = targetAccountInfo

    // update previous addresses
    if (progress) {
      progress(0)
    }
    const addressesData = await Promise.all(addresses.map(address => {
      const bitcoinAddress = address.publicKeyInfo.bitcoinAddress
      return axios.get(`${url.LEDGER_API_URL}/addresses/${bitcoinAddress}/transactions?noToken=true&truncated=true`)
    }))

    const addressesUtxos = addressesData.map((rv, i) => {
      return this.getUtxosFromTxs(rv.data.txs, addresses[i].publicKeyInfo.bitcoinAddress)
    })

    let newBalance = new BN(0)
    let updatedAddresses = []
    addressesUtxos.forEach((utxos, i) => {
      let value = utxos.reduce((accu, utxo) => {
        return new BN(utxo.value).add(accu)
      }, new BN(0))
      newBalance = newBalance.add(value)
      const address = {
        path: addresses[i].path,
        publicKeyInfo: addresses[i].publicKeyInfo,
        utxos: utxos
      }
      updatedAddresses.push(address)
    })

    // discover new address
    const externalAddressData = await this.discoverAddress(xpub, accountIndex, 0, nextAddressIndex, progress)
    const internalAddressData = await this.discoverAddress(xpub, accountIndex, 1, nextChangeIndex, progress)

    let accountData = {
      balance: newBalance.add(new BN(externalAddressData.balance)).add(new BN(internalAddressData.balance)).toString(),
      nextAddressIndex: externalAddressData.nextIndex,
      address: externalAddressData.nextAddress, // address for receiving; match name with ethereum[accountIndex].address
      nextChangeIndex: internalAddressData.nextIndex,
      changeAddress: internalAddressData.nextAddress,
      addresses: [...updatedAddresses, ...externalAddressData.addresses, ...internalAddressData.addresses],
      lastBlockHeight: await getBtcLastBlockHeight(),
      lastUpdate: moment().unix(),
      xpub
    }
    return {
      bitcoin: {
        [accountIndex]: accountData
      }
    }
  }

  // Function to estimate Tx size
  // Referrenced from https://github.com/LedgerHQ/ledger-wallet-webtool/blob/094d3741527e181a626d929d56ab4a515403e4a0/src/TransactionUtils.js#L10
  estimateTransactionSize = (
    inputsCount: number,
    outputsCount: number,
    handleSegwit: boolean
  ) => {
    var maxNoWitness,
      maxSize,
      maxWitness,
      minNoWitness,
      minSize,
      minWitness,
      varintLength
    if (inputsCount < 0xfd) {
      varintLength = 1
    } else if (inputsCount < 0xffff) {
      varintLength = 3
    } else {
      varintLength = 5
    }
    if (handleSegwit) {
      minNoWitness =
        varintLength + 4 + 2 + 59 * inputsCount + 1 + 31 * outputsCount + 4
      maxNoWitness =
        varintLength + 4 + 2 + 59 * inputsCount + 1 + 33 * outputsCount + 4
      minWitness =
        varintLength +
        4 +
        2 +
        59 * inputsCount +
        1 +
        31 * outputsCount +
        4 +
        106 * inputsCount
      maxWitness =
        varintLength +
        4 +
        2 +
        59 * inputsCount +
        1 +
        33 * outputsCount +
        4 +
        108 * inputsCount
      minSize = (minNoWitness * 3 + minWitness) / 4
      maxSize = (maxNoWitness * 3 + maxWitness) / 4
    } else {
      minSize = varintLength + 4 + 146 * inputsCount + 1 + 31 * outputsCount + 4
      maxSize = varintLength + 4 + 148 * inputsCount + 1 + 33 * outputsCount + 4
    }
    return {
      min: minSize,
      max: maxSize
    }
  }
}

export default LedgerNanoS
