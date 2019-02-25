import React, { Component } from 'react'
import { connect } from 'react-redux'
import Recipient from '../components/RecipientComponent'
import { updateTransferForm, generateSecurityAnswer, clearSecurityAnswer } from '../actions/formActions'
import { goToStep } from '../actions/navigationActions'

class RecipientContainer extends Component {
  render () {
    return (
      <Recipient
        {...this.props}
      />
    )
  }
}

const mapDispatchToProps = dispatch => {
  return {
    updateTransferForm: (form) => dispatch(updateTransferForm(form)),
    generateSecurityAnswer: () => dispatch(generateSecurityAnswer()),
    clearSecurityAnswer: () => dispatch(clearSecurityAnswer()),
    goToStep: (n) => dispatch(goToStep('send', n))
  }
}

const mapStateToProps = state => {
  return {
    cryptoSelection: state.formReducer.cryptoSelection,
    transferForm: state.formReducer.transferForm,
    wallet: state.walletReducer.wallet[state.formReducer.walletSelection]
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(RecipientContainer)
