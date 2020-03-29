import LoginPage from './pages/login.page'
import EmailTransferFormPage from './pages/emailTransferForm.page'
import SendReviewPage from './pages/sendReview.page'
import { resetUserDefault } from './utils/reset.js'
import { getWalletTitle } from '../../wallet'
import { getCryptoTitle, getCryptoSymbol } from '../../tokens'
import ReduxTracker from './utils/reduxTracker'

const timeout = 180000

async function goToReview (formInfo) {
  const {
    formPage,
    recipient,
    walletType,
    platformType,
    cryptoType,
    currencyAmount,
    cryptoAmount,
    securityAnswer,
    sendMessage
  } = formInfo
  const reduxTracker = new ReduxTracker()
  await formPage.updateForm('recipient', { email: recipient })
  await formPage.updateForm('account', { walletType: walletType, platformType: platformType })
  await formPage.updateForm('coin', { cryptoType: cryptoType })
  await Promise.all([
    reduxTracker.waitFor(
      [
        {
          action: {
            type: 'GET_TX_COST_FULFILLED'
          }
        }
      ],
      [
        // should not have any errors
        {
          action: {
            type: 'ENQUEUE_SNACKBAR',
            notification: {
              options: {
                variant: 'error'
              }
            }
          }
        }
      ]
    ),
    formPage.updateForm('currencyAmount', { currencyAmount: currencyAmount })
  ])
  await formPage.updateForm('securityAnswer', { securityAnswer: securityAnswer })
  if (sendMessage) {
    await formPage.updateForm('sendMessage', { sendMessage: sendMessage })
  }
  await formPage.dispatchFormActions('continue')
}

describe('Email transfer review tests', () => {
  beforeAll(async () => {
    await resetUserDefault()
    await page.goto(process.env.E2E_TEST_URL)
    // login to app
    const loginPage = new LoginPage()
    await loginPage.login(
      process.env.E2E_TEST_GOOGLE_LOGIN_USERNAME,
      process.env.E2E_TEST_GOOGLE_LOGIN_PASSWORD,
      true
    )
  }, timeout)

  beforeEach(async () => {
    await Promise.all([
      page.waitForNavigation({
        waitUntil: 'networkidle0'
      }),
      page.goto(`${process.env.E2E_TEST_URL}/send`)
    ])
  })

  it(
    'MetamMask Ethereum review',
    async () => {
      const emtPage = new EmailTransferFormPage()
      const recipientName = 'Alice'
      const recipientEmail = 'alice@gmail.com'
      const senderName = 'e2e test'
      const senderEmail = 'chainsfre2etest@gmail.com'

      const securityAnswer = '123456'
      const sendMessage = 'nothing'

      const walletName = 'Metamask ETH'
      const walletType = 'metamask'
      const platformType = 'ethereum'
      const cryptoType = 'ethereum'
      const currencyAmount = '1'

      await goToReview({
        formPage: emtPage,
        recipient: recipientEmail,
        walletType: walletType,
        platformType: platformType,
        cryptoType: cryptoType,
        currencyAmount: currencyAmount,
        securityAnswer: securityAnswer,
        sendMessage: sendMessage
      })
      const reviewPage = new SendReviewPage()

      expect(await reviewPage.getReviewFormInfo('title')).toEqual('Review Details')

      const sender = await reviewPage.getReviewFormInfo('sender')
      expect(sender.name).toEqual(senderName)
      expect(sender.email).toEqual(senderEmail)

      const recipient = await reviewPage.getReviewFormInfo('recipient')
      expect(recipient.name).toEqual(recipientName)
      expect(recipient.email).toEqual(recipientEmail)

      const senderAccount = await reviewPage.getReviewFormInfo('senderAccount')
      expect(senderAccount.walletType).toEqual(getWalletTitle(walletType))
      expect(senderAccount.platformType).toEqual(getCryptoTitle(platformType))
      expect(senderAccount.address).toBeDefined()

      const displayedAmount = await reviewPage.getReviewFormInfo('transferAmount')
      expect(parseFloat(displayedAmount.transferAmount)).toBeGreaterThan(0)
      expect(parseFloat(displayedAmount.currencyAmount)).toEqual(parseFloat(currencyAmount))
      expect(displayedAmount.symbol).toEqual(getCryptoSymbol(cryptoType))

      const displayedTxFee = await reviewPage.getReviewFormInfo('txFee')
      expect(parseFloat(displayedTxFee.txFee)).toBeGreaterThan(0)
      expect(parseFloat(displayedTxFee.currencyTxFee)).toBeGreaterThan(0)
      expect(displayedTxFee.symbol).toEqual(getCryptoSymbol(platformType))

      const securityAnswerTextField = await reviewPage.getReviewFormInfo('securityAnswer')
      expect(securityAnswerTextField.securityAnswer).toEqual(securityAnswer)

      const sendMessageTextField = await reviewPage.getReviewFormInfo('sendMessage')
      expect(sendMessageTextField.message).toEqual(sendMessage)
    },
    timeout
  )

  it(
    'Drive Ethereum review',
    async () => {
      const emtPage = new EmailTransferFormPage()
      const recipientName = 'Alice'
      const recipientEmail = 'alice@gmail.com'
      const senderName = 'e2e test'
      const senderEmail = 'chainsfre2etest@gmail.com'

      const securityAnswer = '123456'
      const sendMessage = 'nothing'

      const walletName = 'Ethereum Cloud Wallet'
      const walletType = 'drive'
      const platformType = 'ethereum'
      const cryptoType = 'ethereum'
      const currencyAmount = '1'

      await goToReview({
        formPage: emtPage,
        recipient: recipientEmail,
        walletType: walletType,
        platformType: platformType,
        cryptoType: cryptoType,
        currencyAmount: currencyAmount,
        securityAnswer: securityAnswer,
        sendMessage: sendMessage
      })
      const reviewPage = new SendReviewPage()

      expect(await reviewPage.getReviewFormInfo('title')).toEqual('Review Details')

      const sender = await reviewPage.getReviewFormInfo('sender')
      expect(sender.name).toEqual(senderName)
      expect(sender.email).toEqual(senderEmail)

      const recipient = await reviewPage.getReviewFormInfo('recipient')
      expect(recipient.name).toEqual(recipientName)
      expect(recipient.email).toEqual(recipientEmail)

      const senderAccount = await reviewPage.getReviewFormInfo('senderAccount')
      expect(senderAccount.walletType).toEqual(getWalletTitle(walletType))
      expect(senderAccount.platformType).toEqual(getCryptoTitle(platformType))
      expect(senderAccount.address).toBeDefined()

      const displayedAmount = await reviewPage.getReviewFormInfo('transferAmount')
      expect(parseFloat(displayedAmount.transferAmount)).toBeGreaterThan(0)
      expect(parseFloat(displayedAmount.currencyAmount)).toEqual(parseFloat(currencyAmount))
      expect(displayedAmount.symbol).toEqual(getCryptoSymbol(cryptoType))

      const displayedTxFee = await reviewPage.getReviewFormInfo('txFee')
      expect(parseFloat(displayedTxFee.txFee)).toBeGreaterThan(0)
      expect(parseFloat(displayedTxFee.currencyTxFee)).toBeGreaterThan(0)
      expect(displayedTxFee.symbol).toEqual(getCryptoSymbol(platformType))

      const securityAnswerTextField = await reviewPage.getReviewFormInfo('securityAnswer')
      expect(securityAnswerTextField.securityAnswer).toEqual(securityAnswer)

      const sendMessageTextField = await reviewPage.getReviewFormInfo('sendMessage')
      expect(sendMessageTextField.message).toEqual(sendMessage)
    },
    timeout
  )

  it(
    'Drive Bitcoin review',
    async () => {
      const emtPage = new EmailTransferFormPage()
      const recipientName = 'Alice'
      const recipientEmail = 'alice@gmail.com'
      const senderName = 'e2e test'
      const senderEmail = 'chainsfre2etest@gmail.com'

      const securityAnswer = '123456'
      const sendMessage = 'nothing'

      const walletName = 'Bitcoin Cloud Wallet'
      const walletType = 'drive'
      const platformType = 'bitcoin'
      const cryptoType = 'bitcoin'
      const currencyAmount = '10'

      await goToReview({
        formPage: emtPage,
        recipient: recipientEmail,
        walletType: walletType,
        platformType: platformType,
        cryptoType: cryptoType,
        currencyAmount: currencyAmount,
        securityAnswer: securityAnswer,
        sendMessage: sendMessage
      })
      const reviewPage = new SendReviewPage()

      expect(await reviewPage.getReviewFormInfo('title')).toEqual('Review Details')

      const sender = await reviewPage.getReviewFormInfo('sender')
      expect(sender.name).toEqual(senderName)
      expect(sender.email).toEqual(senderEmail)

      const recipient = await reviewPage.getReviewFormInfo('recipient')
      expect(recipient.name).toEqual(recipientName)
      expect(recipient.email).toEqual(recipientEmail)

      const senderAccount = await reviewPage.getReviewFormInfo('senderAccount')
      expect(senderAccount.walletType).toEqual(getWalletTitle(walletType))
      expect(senderAccount.platformType).toEqual(getCryptoTitle(platformType))
      expect(senderAccount.address).toBeDefined()

      const displayedAmount = await reviewPage.getReviewFormInfo('transferAmount')
      expect(parseFloat(displayedAmount.transferAmount)).toBeGreaterThan(0)
      expect(parseFloat(displayedAmount.currencyAmount)).toBeGreaterThanOrEqual(
        parseFloat(currencyAmount)
      )
      expect(displayedAmount.symbol).toEqual(getCryptoSymbol(cryptoType))

      const displayedTxFee = await reviewPage.getReviewFormInfo('txFee')
      expect(parseFloat(displayedTxFee.txFee)).toBeGreaterThan(0)
      expect(parseFloat(displayedTxFee.currencyTxFee)).toBeGreaterThan(0)
      expect(displayedTxFee.symbol).toEqual(getCryptoSymbol(platformType))

      const securityAnswerTextField = await reviewPage.getReviewFormInfo('securityAnswer')
      expect(securityAnswerTextField.securityAnswer).toEqual(securityAnswer)

      const sendMessageTextField = await reviewPage.getReviewFormInfo('sendMessage')
      expect(sendMessageTextField.message).toEqual(sendMessage)
    },
    timeout
  )
})