import axios from 'axios'
import { Base64 } from 'js-base64'

const apiTransfer = axios.create({
  baseURL: 'https://cr7j581ggh.execute-api.us-east-1.amazonaws.com/Prod',
  headers: {
    'Content-Type': 'application/json'
  }
})

async function transfer ({ clientId, sender, destination, transferAmount, cryptoType, data, sendTxHash }) {
  let apiResponse = await apiTransfer.post('/transfer', {
    action: 'SEND',
    clientId: clientId,
    sender: sender,
    destination: destination,
    transferAmount: transferAmount,
    cryptoType: cryptoType,
    data: Base64.encode(JSON.stringify(data)),
    sendTxHash: sendTxHash
  })
  return apiResponse.data
}

async function accept ({ clientId, receivingId, receiveTxHash }) {
  let apiResponse = await apiTransfer.post('/transfer', {
    action: 'RECEIVE',
    clientId: clientId,
    receivingId: receivingId,
    receiveTxHash: receiveTxHash
  })
  return apiResponse.data
}

async function cancel ({ clientId, sendingId, cancelTxHash }) {
  let apiResponse = await apiTransfer.post('/transfer', {
    action: 'CANCEL',
    clientId: clientId,
    sendingId: sendingId,
    cancelTxHash: cancelTxHash
  })
  return apiResponse.data
}

async function getTransfer ({ sendingId, receivingId }) {
  let rv = await apiTransfer.post('/transfer', {
    action: 'GET',
    sendingId: sendingId,
    receivingId: receivingId
  })

  let responseData = rv.data
  responseData.data = JSON.parse(Base64.decode(responseData.data))
  return responseData
}

export default { transfer, accept, cancel, getTransfer }
