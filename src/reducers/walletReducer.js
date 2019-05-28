/*
 *  Handle wallet actions amd wallet data
 */

import update from 'immutability-helper'
import { REHYDRATE } from 'redux-persist/lib/constants'

const initState = {
  wallet: {
    escrow: {
      crypto: {}
    },
    drive: {
      unlockRequest: null,
      connected: false,
      crypto: {}
    },
    ledger: {
      connected: false,
      network: null,
      crypto: {}
    },
    metamask: {
      connected: false,
      network: null,
      crypto: {}
    }
  },
  lastUsedWallet: {
    notUsed: false,
    drive: {
      crypto: {}
    },
    metamask: {
      crypto: {}
    },
    ledger: {
      crypto: {}
    }
  }
}

export default function (state = initState, action) {
  switch (action.type) {
    // metamask
    case 'CHECK_METAMASK_CONNECTION_FULFILLED':
      let walletData = action.payload
      return update(state, { wallet: { metamask: { $merge: {
        connected: true,
        crypto: { [walletData.cryptoType]: walletData.accounts }
      } } } })
    case 'UPDATE_METAMASK_ACCOUNTS':
      return update(state, { wallet: { metamask: { accounts: { $set: action.payload } } } })
    // ledger
    case 'CHECK_LEDGER_NANOS_CONNECTION_FULFILLED':
      return update(state, { wallet: { ledger: { $merge: action.payload } } })
    case 'CHECK_LEDGER_NANOS_CONNECTION_PENDING':
      return update(state, { wallet: { ledger: { $merge: { connected: false } } } })
    case 'CHECK_LEDGER_NANOS_CONNECTION_REJECTED':
      return update(state, { wallet: { ledger: { $merge: {
        connected: false,
        network: null
      } } } })
    case 'CHECK_CLOUD_WALLET_CONNECTION_FULFILLED':
      return update(state, { wallet: { drive: { $merge: action.payload } } })
    // escrow wallet actions
    case 'VERIFY_PASSWORD_FULFILLED':
    // store decrypted wallet
      return update(state, { escrowWallet: { decryptedWallet: { $set: action.payload } } })
    case 'CLEAR_DECRYPTED_WALLET':
      return update(state, { escrowWallet: { decryptedWallet: { $set: null } } })
    case 'SYNC_LEDGER_ACCOUNT_INFO_FULFILLED':
      return update(state, { wallet: { ledger: { crypto: { $merge: action.payload } } } })
    case 'UPDATE_BTC_ACCOUNT_INFO_FULFILLED':
      return update(state, { wallet: { ledger: { crypto: { $merge: action.payload } } } })
    case 'GET_UTXO_FOR_ESCROW_WALLET_FULFILLED':
      return update(state, { escrowWallet: { decryptedWallet: { $merge: action.payload } } })
    case 'GET_CLOUD_WALLET_FULFILLED':
    case 'CREATE_CLOUD_WALLET_FULFILLED':
      return update(state, { wallet: { drive: { $merge: action.payload } } })
    case 'DECRYPT_CLOUD_WALLET_FULFILLED':
      return update(state, {
        wallet: {
          drive: {
            crypto: {
              [action.payload.cryptoType]: {
                0: {
                  privateKey: {
                    $set: action.payload.decryptedWallet.privateKey
                  }
                }
              }
            }
          }
        }
      })
    case 'UNLOCK_CLOUD_WALLET':
      return update(state, {
        wallet: {
          drive: {
            unlockRequest: {
              $set: action.payload
            }
          }
        }
      })
    case 'GET_LAST_USED_ADDRESS_FULFILLED':
      return update(state, {
        lastUsedWallet: {
          $merge: { ...action.payload }
        }
      })
    case 'NOT_USED_LAST_ADDRESS':
      return update(state, {
        lastUsedWallet: {
          notUsed: { $set: true }
        }
      })
    case REHYDRATE:
      if (action.payload) {
        var incoming = action.payload.walletReducer.wallet.ledger
        if (incoming) return update(state, { wallet: { ledger: { $merge: incoming } } })
      }
      return state
    default: // need this for default case
      return state
  }
}
