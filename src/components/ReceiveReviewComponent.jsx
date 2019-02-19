import React, { Component } from 'react'
import Grid from '@material-ui/core/Grid'
import Button from '@material-ui/core/Button'
import { withStyles } from '@material-ui/core/styles'
import { Link } from 'react-router-dom'
import Typography from '@material-ui/core/Typography'
import Paper from '@material-ui/core/Paper'
import CircularProgress from '@material-ui/core/CircularProgress'
import paths from '../Paths'
import moment from 'moment'

const cryptoAbbreviationMap = {
  'ethereum': 'ETH',
  'bitcoin': 'BTC',
  'dai': 'DAI'
}

class ReceiveReviewComponent extends Component {
  handleReviewNext = () => {
    const { transfer, escrowWallet, metamask, walletSelection, gasCost } = this.props
    const { id, transferAmount, sender, destination } = transfer

    // accept transfer
    // TODO handle ledger nano s and erc20 tokens
    this.props.acceptTransfer({
      id: id,
      escrowWallet: escrowWallet.decryptedWallet,
      destinationAddress: metamask.accounts[0],
      walletType: walletSelection,
      cryptoType: transfer.cryptoType,
      transferAmount: transferAmount,
      destination: destination,
      sender: sender,
      sendTimestamp: transfer.sendTimestamp,
      gas: gasCost.gas,
      gasPrice: gasCost.gasPrice
    })
  }

  componentDidMount () {
    // refresh gas cost
    const { metamask, transfer } = this.props
    const { transferAmount } = transfer
    this.props.getGasCost({
      fromWallet: metamask,
      cryptoType: transfer.cryptoType,
      transferAmount: transferAmount
    })
  }

  render () {
    const { classes, metamask, transfer, walletSelection, cryptoSelection, actionsPending, gasCost } = this.props
    const { transferAmount, sender, destination, sendTimestamp } = transfer

    if (walletSelection === 'metamask') {
      var address = metamask.accounts[0]
    }
    // TODO handle ledger address

    return (
      <Grid container direction='column' justify='center' alignItems='stretch'>
        <Grid item>
          <Grid container direction='column' justify='center' alignItems='center'>
            <Grid item>
              <Grid item>
                <Typography className={classes.title} variant='h6' align='center'>
                  Pending Transaction
                </Typography>
              </Grid>
              <Paper className={classes.reviewItemContainer}>
                <Grid item className={classes.reviewItem}>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    From
                  </Typography>
                  <Typography className={classes.reviewContent} align='left'>
                    {sender}
                  </Typography>
                </Grid>
                <Grid item className={classes.reviewItem}>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    To
                  </Typography>
                  <Typography className={classes.reviewContent} align='left'>
                    {destination}
                  </Typography>
                </Grid>
                <Grid item className={classes.reviewItem}>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    Sent on
                  </Typography>
                  <Typography className={classes.reviewContent} align='left'>
                    {moment.unix(sendTimestamp).format('MMM Do YYYY, HH:mm:ss')}
                  </Typography>
                </Grid>
                <Grid item className={classes.reviewItem}>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    Wallet Address
                  </Typography>
                  <Typography className={classes.reviewContent} align='left'>
                    {address}
                  </Typography>
                </Grid>
                <Grid item className={classes.reviewItem}>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    Amount
                  </Typography>
                  <Typography className={classes.reviewContentAmount} align='left'>
                    {transferAmount} {cryptoAbbreviationMap[cryptoSelection]}
                  </Typography>
                </Grid>
                <Grid item className={classes.reviewItem}>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    Gas Fee
                  </Typography>
                  <Typography className={classes.reviewContent} align='left'>
                    {!actionsPending.getGasCost && gasCost
                      ? `${gasCost.costInEther} ETH`
                      : <CircularProgress size={18} color='primary' />}
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography className={classes.reviewSubtitle} align='left'>
                    You will receive*
                  </Typography>
                  <Typography className={classes.reviewContent} align='left'>
                    {!actionsPending.getGasCost && gasCost
                      ? `${parseFloat(transferAmount) - parseFloat(gasCost.costInEther)} ETH`
                      : <CircularProgress size={18} color='primary' />}
                  </Typography>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
        <Grid item className={classes.btnSection}>
          <Grid container direction='row' justify='center' spacing={24}>
            <Grid item>
              <Button
                color='primary'
                size='large'
                component={Link}
                to={paths.receive}
              >
                Cancel
              </Button>
            </Grid>
            <Grid item>
              <div className={classes.wrapper}>
                <Button
                  fullWidth
                  variant='contained'
                  color='primary'
                  size='large'
                  disabled={actionsPending.acceptTransfer}
                  onClick={this.handleReviewNext}
                >
                  Complete
                </Button>
                {actionsPending.acceptTransfer && <CircularProgress size={24} color='primary' className={classes.buttonProgress} />}
              </div>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    )
  }
}

const styles = theme => ({
  title: {
    color: '#333333',
    fontSize: '18px',
    fontWeight: '600',
    lineHeight: '24px',
    padding: '0px 0px 0px 0px',
    marginBottom: '20px'
  },
  reviewItemContainer: {
    border: 'border: 1px solid #D2D2D2',
    borderRadius: '8px',
    backgroundColor: '#FAFAFA',
    padding: '20px'
  },
  reviewSubtitle: {
    color: '#777777',
    fontSize: '12px',
    lineHeight: '17px'
  },
  reviewContent: {
    color: '#333333',
    fontSize: '18px',
    lineHeight: '24px'
  },
  reviewContentAmount: {
    color: '#333333',
    fontSize: '18px',
    lineHeight: '24px',
    fontWeight: 'bold'
  },
  reviewItem: {
    marginBottom: '30px'
  },
  btnSection: {
    marginTop: '60px'
  },
  buttonProgress: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -12,
    marginLeft: -12
  },
  wrapper: {
    position: 'relative'
  }
})

export default withStyles(styles)(ReceiveReviewComponent)