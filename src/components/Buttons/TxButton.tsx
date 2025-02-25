import { Button, ButtonProps } from '@pooltogether/react-components'
import { getNetworkNiceNameByChainId } from '@pooltogether/utilities'
import {
  TransactionState,
  TransactionStatus,
  useConnectWallet,
  useIsWalletConnected,
  useIsWalletOnChainId
} from '@pooltogether/wallet-connection'
import { useTranslation } from 'next-i18next'
import React, { useMemo } from 'react'
import { useSwitchNetwork } from 'wagmi'

export interface TxButtonProps extends ButtonProps {
  state?: TransactionState
  status?: TransactionStatus
  chainId: number
}

/**
 *
 * @param props
 * @returns
 */
export const TxButton = (props: TxButtonProps) => {
  const {
    chainId,
    state,
    status,
    children,
    onClick: _onClick,
    disabled: _disabled,
    ...squareButtonProps
  } = props
  const isWalletConnected = useIsWalletConnected()
  const connectWallet = useConnectWallet()
  const { switchNetwork } = useSwitchNetwork()

  const { t } = useTranslation()

  const isWalletOnProperNetwork = useIsWalletOnChainId(chainId)
  const networkName = getNetworkNiceNameByChainId(chainId)
  const disabled =
    (_disabled || state === TransactionState.pending) &&
    isWalletConnected &&
    (isWalletOnProperNetwork || state === TransactionState.pending)

  const [content, onClick] = useMemo(() => {
    if (!isWalletConnected) {
      return [t('connectWallet'), connectWallet]
    } else if (status === TransactionStatus.pendingUserConfirmation) {
      return [t('confirmInWallet'), () => null]
    } else if (status === TransactionStatus.pendingBlockchainConfirmation) {
      return [t('transactionPending', 'Transaction pending'), () => null]
    } else if (!isWalletOnProperNetwork) {
      return [t('connectToNetwork', { networkName }), () => switchNetwork(chainId)]
    } else {
      return [children, _onClick]
    }
  }, [chainId, state, status, isWalletOnProperNetwork, _onClick])

  return (
    <>
      <Button {...squareButtonProps} onClick={(e) => onClick?.(e)} disabled={disabled}>
        {content}
      </Button>
    </>
  )
}
