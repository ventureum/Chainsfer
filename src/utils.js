// @flow
import BN from 'bn.js'
import randomBytes from 'randombytes'
import wordlist from './wordlist.js'
import axios from 'axios'
import bcrypt from 'bcryptjs'
import url from './url'
import numeral from 'numeral'
import type { StandardTokenUnit } from './types/token.flow'
import type { AccountData } from './types/account.flow.js'
/*
 * @param val string, assuming smallest token unit
 * @return float number of val/(10**decimals) with precision [precision]
 */
function toHumanReadableUnit (val: any, decimals: number = 18, precision: number = 6): any {
  if (decimals === 0) return parseFloat(val)
  let base = new BN(10).pow(new BN(decimals - precision))
  let precisionBase = new BN(10).pow(new BN(precision))
  let rv = new BN(val).div(base)
  return parseFloat(rv.toString()) / parseFloat(precisionBase)
}

/*
 * @param val float number representing token units with precision [precision]
 * @return BN smallest token unit
 */
function toBasicTokenUnit (val: any, decimals: number = 18, precision: number = 6) {
  if (decimals === 0) return new BN(val)
  let base = new BN(10).pow(new BN(decimals - precision))
  let precisionBase = new BN(10).pow(new BN(precision))
  let rv = parseInt(val * precisionBase.toNumber())
  return new BN(rv).mul(base)
}

/**
 * Converts a byte array into a passphrase.
 * @param {Buffer} bytes The bytes to convert
 * @returns {Array.<string>}
 */
function bytesToPassphrase (bytes: Buffer) {
  // Uint8Array should only be used when this is called in the browser
  // context.
  if (
    !Buffer.isBuffer(bytes) &&
    !(typeof window === 'object' && bytes instanceof window.Uint8Array)
  ) {
    throw new Error('Input must be a Buffer or Uint8Array.')
  }

  if ((bytes.length * 8) % 12 !== 0) {
    // 4096 words = 12 bit per word
    throw new Error('Must be divisible by 12 bit')
  }

  const words = []
  let byteIdx = 0
  while (byteIdx < bytes.length) {
    let len = words.length
    let wordIdx = null
    if (len % 2 === 0) {
      // 1 byte + next 4 bit
      wordIdx = (bytes[byteIdx] << 4) + (bytes[byteIdx + 1] >> 4)
    } else {
      // 4 bit + next 1 byte
      wordIdx = (bytes[byteIdx] % 16 << 8) + bytes[byteIdx + 1]
      // skip next byte
      byteIdx++
    }

    let word = wordlist[wordIdx]
    if (!word) {
      throw new Error('Invalid byte encountered')
    } else {
      words.push(word)
    }

    byteIdx++
  }

  return words
}

/**
 * Generates a random passphrase with the specified number of bytes.
 * NOTE: `size` must be an even number.
 * @param {number} size The number of random bytes to use
 * @returns {Array.<string>}
 */
function generatePassphrase (size: number) {
  const MAX_PASSPHRASE_SIZE = 1024 // Max size of passphrase in bytes

  if (typeof size !== 'number' || size < 0 || size > MAX_PASSPHRASE_SIZE) {
    throw new Error(`Size must be between 0 and ${MAX_PASSPHRASE_SIZE} bytes.`)
  }
  const bytes = randomBytes(size)
  return bytesToPassphrase(bytes)
}

async function getBtcTxFeePerByte () {
  const rv = (await axios.get(url.BTC_FEE_ENDPOINT)).data
  // safety check
  if (new BN(rv.fastestFee).gt(new BN(200))) {
    console.warn(new Error('Abnormal btc fee per byte'))
    return 200
  }
  return rv.fastestFee
}

/*
 * cryptr is a simple aes-256-ctr encrypt and decrypt module for node.js
 *
 * Usage:
 *
 * const cryptr = new Cryptr('myTotalySecretKey');
 *
 * const encryptedString = cryptr.encrypt('bacon');
 * const decryptedString = cryptr.decrypt(encryptedString);
 *
 * console.log(encryptedString); // 5590fd6409be2494de0226f5d7
 * console.log(decryptedString); // bacon
 */
function Cryptr (secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Cryptr: secret must be a non-0-length string')
  }

  const crypto = require('crypto')
  const algorithm = 'aes-256-ctr'
  const key = crypto
    .createHash('sha256')
    .update(String(secret))
    .digest()

  this.encrypt = function encrypt (value) {
    if (value == null) {
      throw new Error('value must not be null or undefined')
    }

    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    const encrypted = cipher.update(String(value), 'utf8', 'hex') + cipher.final('hex')

    return iv.toString('hex') + encrypted
  }

  this.decrypt = function decrypt (value) {
    if (value == null) {
      throw new Error('value must not be null or undefined')
    }

    const stringValue = String(value)
    const iv = Buffer.from(stringValue.slice(0, 32), 'hex')
    const encrypted = stringValue.slice(32)

    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8')
  }
}

async function encryptMessage (message: string, password: string): Promise<string> {
  const cryptr = new Cryptr(password)
  return JSON.stringify({
    hash: await bcrypt.hash(message, 10),
    encryptedMessage: cryptr.encrypt(message)
  })
}

async function decryptMessage (encryptedMessage: string, password: string): Promise<?string> {
  const cryptr = new Cryptr(password)
  let encryptedMessageObj = JSON.parse(encryptedMessage)
  let message = cryptr.decrypt(encryptedMessageObj.encryptedMessage)
  if (!(await bcrypt.compare(message, encryptedMessageObj.hash))) {
    // decryption failed
    return null
  }
  return message
}

function toCurrencyAmount (
  cryptoAmount: StandardTokenUnit,
  price: number,
  symbol: ?string
): string {
  let rv = numeral(parseFloat(cryptoAmount) * price).format('0.00[0]')
  if (symbol) rv = rv + ` ${symbol}`
  return rv
}

function toCryptoAmount (
  currencyAmount: StandardTokenUnit,
  price: number,
  symbol: ?string
): string {
  let rv = numeral(parseFloat(currencyAmount) / price).format('0.000[000]')
  if (isNaN(rv)) {
    // NaN value displayed on Balance when the value is <= 0.0000001 caused by a bug on NumeralJs
    rv = numeral(0).format('0.000[000]')
  }
  if (symbol) rv = rv + ` ${symbol}`
  return rv
}

function formatNumber (number: number | string): string {
  return numeral(number).format('0.000[000]')
}

function accountsEqual (account1: AccountData, account2: AccountData): boolean {
  if (!account1 || !account2) return false
  return account1.id === account2.id
}
export default {
  toHumanReadableUnit,
  toBasicTokenUnit,
  generatePassphrase,
  getBtcTxFeePerByte,
  encryptMessage,
  decryptMessage,
  toCurrencyAmount,
  toCryptoAmount,
  accountsEqual,
  formatNumber
}
