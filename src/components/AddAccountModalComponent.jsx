// @flow
import React, { Component } from 'react'
import { withStyles } from '@material-ui/core/styles'

import Button from '@material-ui/core/Button'
import Box from '@material-ui/core/Box'
import CropFreeIcon from '@material-ui/icons/CropFree'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import DialogActions from '@material-ui/core/DialogActions'
import CloseIcon from '@material-ui/icons/Close'
import Grid from '@material-ui/core/Grid'
import Typography from '@material-ui/core/Typography'
import LinearProgress from '@material-ui/core/LinearProgress'
import IconButton from '@material-ui/core/IconButton'
import UsbIcon from '@material-ui/icons/Usb'
import OpenInBrowser from '@material-ui/icons/OpenInBrowser'
import { WalletButton } from './WalletSelectionButtons.jsx'
import { walletSelections, walletCryptoSupports, getWalletConfig } from '../wallet'
import { getCryptoTitle } from '../tokens'
import Radio from '@material-ui/core/Radio'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import TextField from '@material-ui/core/TextField'
import walletErrors from '../wallets/walletErrors'
import withMobileDialog from '@material-ui/core/withMobileDialog'

type Props = {
  walletType: string,
  cryptoType: string,
  classes: Object,
  name: string,
  open: boolean,
  actionsPending: Object,
  handleClose: Function,
  onConnect: Function,
  newCryptoAccount: Object,
  checkWalletConnection: Function,
  errors: Object,
  onSubmit: Function,
  online: boolean,
  fullScreen: boolean
}

type State = {
  step: number,
  walletType: string,
  cryptoType: string,
  name: string
}

class AddAccountModalComponent extends Component<Props, State> {
  state = {
    step: 0,
    walletType: '',
    cryptoType: '',
    name: ''
  }

  componentDidUpdate (prevProps) {
    const { walletType, cryptoType, name } = this.state
    const { onConnect, newCryptoAccount, actionsPending, errors } = this.props
    if (
      prevProps.actionsPending.checkWalletConnection &&
      !actionsPending.checkWalletConnection &&
      !errors.checkWalletConnection
    ) {
      onConnect('default', cryptoType, walletType)
    } else if (
      prevProps.actionsPending.newCryptoAccountFromWallet &&
      !actionsPending.newCryptoAccountFromWallet &&
      !errors.newCryptoAccountFromWallet
    ) {
      this.setState({ step: 2 })
    }

    if (
      newCryptoAccount &&
      newCryptoAccount.walletType === 'coinbaseOAuthWallet' &&
      newCryptoAccount.email &&
      name.length === 0
    ) {
      // for coinbaseOAuthWallet, fill name with email address if email is provided
      this.setState({ name: newCryptoAccount.email })
    }
  }

  handleWalletSelect = walletType => {
    this.setState({ step: 1, walletType })
  }

  handleCryptoSelect = cryptoType => {
    this.setState({ cryptoType })
  }

  handleAccountNameChange = accountName => {
    this.setState({ name: accountName })
  }

  locked = () => {
    const { actionsPending } = this.props
    return actionsPending.checkWalletConnection || actionsPending.newCryptoAccountFromWallet
  }

  renderWalletSelections = () => {
    return (
      <Grid container spacing={3} direction='row' align='center'>
        {walletSelections
          .filter(w => {
            return w.walletType !== 'drive' && !w.hide && w.walletType !== 'metamaskOne'
          })
          .map((w, i) => {
            return (
              <Grid item xs={6} md={4} key={i}>
                <WalletButton
                  walletType={w.walletType}
                  handleClick={this.handleWalletSelect}
                  disabled={!getWalletConfig(w.walletType).addable}
                  disabledReason={getWalletConfig(w.walletType).disabledReason}
                />
              </Grid>
            )
          })}
      </Grid>
    )
  }

  renderCryptoSelections = () => {
    const { actionsPending } = this.props
    const { walletType, cryptoType } = this.state
    if (walletType === '') {
      return null
    }

    return (
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <WalletButton walletType={walletType} />
        </Grid>
        <Grid item xs>
          <Grid container spacing={1} direction='column'>
            <Grid item>
              <Typography>Select coin type</Typography>
            </Grid>
            <Grid item>
              <List>
                {walletCryptoSupports[walletType].map((c, i) => {
                  return (
                    <ListItem
                      key={i}
                      button
                      onClick={() => {
                        this.handleCryptoSelect(c.cryptoType)
                      }}
                      disabled={this.locked()}
                    >
                      <Radio checked={cryptoType === c.cryptoType} />
                      <ListItemText primary={getCryptoTitle(c.cryptoType)} />
                    </ListItem>
                  )
                })}
              </List>
            </Grid>
            {cryptoType !== '' &&
              !actionsPending.checkWalletConnection &&
              !actionsPending.newCryptoAccountFromWallet && (
                <Grid item>{this.renderWalletConnect()}</Grid>
              )}
            {(actionsPending.checkWalletConnection ||
              actionsPending.newCryptoAccountFromWallet) && (
              <Grid item>{this.renderCheckWalletConnectionInstruction()}</Grid>
            )}
          </Grid>
        </Grid>
      </Grid>
    )
  }

  renderCheckWalletConnectionInstruction = () => {
    const { actionsPending } = this.props
    const { walletType, cryptoType } = this.state
    let instruction = ''
    switch (walletType) {
      case 'metamask':
        if (actionsPending.checkWalletConnection) {
          instruction = 'Checking if MetaMask extension is installed and enabled...'
        } else {
          instruction = 'Waiting for authorization...'
        }
        break
      case 'ledger':
        if (actionsPending.newCryptoAccountFromWallet && cryptoType === 'bitcoin') {
          instruction = 'Please wait while we sync your Bitcoin account with the network...'
        } else if (actionsPending.checkWalletConnection) {
          instruction = 'Please connect your Ledger Device and connect it through popup window...'
        } else {
          instruction = 'Please navigate to selected crypto on your Ledger device...'
        }
        break
      case 'trustWalletConnect':
      case 'metamaskWalletConnect':
        if (actionsPending.checkWalletConnection) {
          instruction = 'Creating connection...'
        } else {
          instruction = 'Please scan the QR code with MetaMask Mobile app...'
        }
        break
      default:
        instruction = 'Please wait...'
    }

    return (
      <Box style={{ width: '100%' }}>
        <Typography variant='body2'>{instruction}</Typography>
        <LinearProgress style={{ marginTop: '10px' }} />
      </Box>
    )
  }

  renderWalletConnect = () => {
    const { checkWalletConnection, errors, online } = this.props
    const { walletType, cryptoType } = this.state
    let connectText, buttonText, buttonIcon
    let errorInstruction
    switch (walletType) {
      case 'metamask':
        connectText = 'Connect your wallet via browser extendsion'
        buttonText = 'Connect to MetaMask'
        buttonIcon = <OpenInBrowser />
        if (errors.checkWalletConnection === walletErrors.metamask.extendsionNotFound) {
          errorInstruction = 'MetaMask extension is not available'
        } else if (errors.newCryptoAccountFromWallet === walletErrors.metamask.incorrectNetwork) {
          errorInstruction = 'Incorrect MetaMask network'
        } else if (
          errors.newCryptoAccountFromWallet === walletErrors.metamask.authorizationDenied
        ) {
          errorInstruction = 'MetaMask authorization denied'
        }
        break
      case 'ledger':
        connectText = 'Plug-in and connect to your ledger divice'
        buttonText = 'Connect to Ledger'
        buttonIcon = <UsbIcon />
        if (errors.checkWalletConnection === walletErrors.ledger.deviceNotConnected) {
          errorInstruction = 'Ledger device is not connected'
        } else if (
          errors.newCryptoAccountFromWallet === walletErrors.ledger.ledgerAppCommunicationFailed
        ) {
          errorInstruction = `Ledger ${cryptoType} app is not available`
        }
        break
      case 'trustWalletConnect':
      case 'metamaskWalletConnect':
        connectText = 'Connect your wallet via Wallet Connect'
        buttonText = 'Scan QR Code'
        buttonIcon = <CropFreeIcon />
        if (errors.checkWalletConnection) {
          errorInstruction = 'WalletConnect loading failed'
        } else if (
          errors.newCryptoAccountFromWallet === walletErrors.metamaskWalletConnect.modalClosed
        ) {
          errorInstruction = `User denied account authorization`
        }
        break
      case 'coinbaseWalletLink':
        connectText = 'Connect your wallet via WalletLink'
        buttonText = 'Scan QR Code'
        buttonIcon = <CropFreeIcon />
        if (errors.checkWalletConnection) {
          errorInstruction = 'WalletLink loading failed'
        } else if (
          errors.newCryptoAccountFromWallet === walletErrors.coinbaseWalletLink.authorizationDenied
        ) {
          errorInstruction = `User denied account authorization`
        }
        break
      case 'coinbaseOAuthWallet':
        connectText = `Fetch Coinbase ${getCryptoTitle(cryptoType)} accounts`
        buttonText = 'Authorize Chainsfr'
        buttonIcon = <OpenInBrowser />
        if (errors.checkWalletConnection) {
          errorInstruction = 'Failed to get authorization from Coinbase'
        } else if (
          errors.newCryptoAccountFromWallet === walletErrors.coinbaseOAuthWallet.accountNotFound
        ) {
          errorInstruction = `Please select the ${cryptoType} account in the Coinbase pop window`
        } else if (
          errors.newCryptoAccountFromWallet === walletErrors.coinbaseOAuthWallet.noAddress
        ) {
          errorInstruction = `No ${cryptoType} address is available from Coinbase`
        } else if (errors.newCryptoAccountFromWallet === walletErrors.coinbaseOAuthWallet.cryptoTypeNotMatched) {
          errorInstruction = errors.newCryptoAccountFromWallet
        }
        break
      default:
        throw new Error('Invalid wallet type')
    }
    return (
      <Grid container spacing={1} direction='column'>
        <Grid item>
          <Typography variant='body2'>{connectText}</Typography>
        </Grid>
        <Grid item>
          <Button
            color='primary'
            onClick={() => {
              checkWalletConnection({ walletType: walletType, cryptoType: cryptoType })
            }}
            disabled={this.locked() || !online}
          >
            {buttonIcon}
            {buttonText}
          </Button>
        </Grid>
        {errorInstruction && (
          <Grid item>
            <Box
              style={{
                backgroundColor: 'rgba(57, 51, 134, 0.05)',
                borderRadius: '4px',
                padding: '20px'
              }}
            >
              <Typography variant='body2' color='error'>
                {errorInstruction}
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>
    )
  }

  renderNameNewAccount = () => {
    const { newCryptoAccount, actionsPending } = this.props
    const { name, walletType } = this.state

    if (newCryptoAccount && !actionsPending.newCryptoAccountFromWallet) {
      return (
        <Grid container spacing={2}>
          <Grid item xs={4}>
            <WalletButton walletType={walletType} />
          </Grid>
          <Grid item xs>
            <Grid container spacing={3} direction='column'>
              <Grid item>
                <Typography>Wallet Connected</Typography>
                {newCryptoAccount.cryptoType !== 'bitcoin' ? (
                  <Typography variant='body2'>
                    Wallet address: {newCryptoAccount.address}
                  </Typography>
                ) : newCryptoAccount.hdWalletVariables &&
                  newCryptoAccount.hdWalletVariables.xpub ? (
                  <Typography variant='caption'>
                    Account xpub: {newCryptoAccount.hdWalletVariables.xpub.slice(0, 16)}...
                    {newCryptoAccount.hdWalletVariables.xpub.slice(-24)}
                  </Typography>
                ) : (
                  <Typography variant='body2'>
                    Account address: {newCryptoAccount.address}
                  </Typography>
                )}
              </Grid>
              <Grid item>
                <TextField
                  margin='normal'
                  fullWidth
                  id='account name'
                  variant='outlined'
                  label='Account Name'
                  onChange={event => {
                    this.handleAccountNameChange(event.target.value)
                  }}
                  disabled={newCryptoAccount.email} // force using email as name
                  value={name}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      )
    }
  }

  renderSteps = () => {
    const { step } = this.state
    switch (step) {
      case 0:
        return this.renderWalletSelections()
      case 1:
        return this.renderCryptoSelections()
      case 2:
        return this.renderNameNewAccount()
      default:
        return this.renderWalletSelections()
    }
  }

  render () {
    const { open, handleClose, onSubmit, newCryptoAccount, fullScreen, classes } = this.props
    const { step, name } = this.state
    return (
      <Dialog
        open={open}
        fullScreen={fullScreen}
        onClose={() => {
          if (!this.locked) handleClose()
        }}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle disableTypography>
          <Typography variant='h2'>Connect to Account</Typography>
          <IconButton
            onClick={handleClose}
            className={classes.closeButton}
            disabled={this.locked()}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent style={{height: '400px'}}>
          {this.renderSteps()}
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center', marginBottom: '10px' }}>
          <Button
            onClick={() => {
              handleClose()
            }}
            disabled={this.locked()}
          >
            Cancel
          </Button>
          <Button
            variant='contained'
            color='primary'
            // name cannot be empty
            disabled={step !== 2 && name.length > 0}
            onClick={() => {
              onSubmit({ ...newCryptoAccount, name: name })
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

const styles = theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500]
  }
})

export default withStyles(styles)(withMobileDialog()(AddAccountModalComponent))
