import { createContext, useState, useEffect } from 'react'
import { useMoralis, useMoralisQuery } from 'react-moralis'
import { nabeezonAbi, nabeezonCoinAddress } from '../lib/constants'
import { ethers } from 'ethers'

export const NabeezonContext = createContext()

export const NabeezonProvider = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState('')
  const [formattedAccount, setFormattedAccount] = useState('')
  const [balance, setBalance] = useState('')
  const [tokenAmount, setTokenAmount] = useState('')
  const [amountDue, setAmountDue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [etherscanLink, setEtherscanLink] = useState('')
  const [nickname, setNickname] = useState('')
  const [username, setUsername] = useState('')
  const [assets, setAssets] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [ownedItems, setOwnedItems] = useState([])

  const {
    authenticate,
    isAuthenticated,
    enableWeb3,
    Moralis,
    user,
    isWeb3Enabled,
  } = useMoralis()

  const {
    data: userData,
    error: userDataError,
    isLoading: userDataIsLoading,
  } = useMoralisQuery('_User')

  const {
    data: assetsData,
    error: assetsDataError,
    isLoading: assetsDataIsLoading,
  } = useMoralisQuery('Assets')

  useEffect(async () => {
    console.log(assetsData)
    await enableWeb3()
    await getAssets()
    await getOwnedAssets()
  }, [userData, assetsData, assetsDataIsLoading, userDataIsLoading])

  useEffect(async () => {
    if (!isWeb3Enabled) {
      await enableWeb3()
    }
    await listenToUpdates()

    if (isAuthenticated) {
      await getBalance()
      const currentUsername = await user?.get('nickname')
      setUsername(currentUsername)
      const account = await user?.get('ethAddress')
      setCurrentAccount(account)
      const formatAccount = account.slice(0, 5) + '...' + account.slice(-5)
      setFormattedAccount(formatAccount)
    } else {
      setCurrentAccount('')
      setFormattedAccount('')
      setBalance('')
    }
  }, [
    isWeb3Enabled,
    isAuthenticated,
    balance,
    setBalance,
    authenticate,
    currentAccount,
    setUsername,
    user,
    username,
  ])

  const connectWallet = async () => {
    await enableWeb3()
    await authenticate()
  }

  const buyTokens = async () => {
    if (!isAuthenticated) {
      await connectWallet()
    }

    const amount = ethers.BigNumber.from(tokenAmount)
    const price = ethers.BigNumber.from('100000000000000')
    const calcPrice = amount.mul(price)

    console.log(nabeezonCoinAddress)

    let options = {
      contractAddress: nabeezonCoinAddress,
      functionName: 'mint',
      abi: nabeezonAbi,
      msgValue: calcPrice,
      params: {
        amount,
      },
    }
    const transaction = await Moralis.executeFunction(options)
    const receipt = await transaction.wait()
    setIsLoading(false)
    console.log(receipt)
    setEtherscanLink(
      `https://ropsten.etherscan.io/tx/${receipt.transactionHash}`,
    )
  }

  const handleSetUsername = () => {
    if (user) {
      if (nickname) {
        user.set('nickname', nickname)
        user.save()
        setNickname('')
      } else {
        console.log("Can't set empty nickname")
      }
    } else {
      console.log('No user')
    }
  }

  const getBalance = async () => {
    try {
      if (!isAuthenticated || !currentAccount) return
      const options = {
        contractAddress: nabeezonCoinAddress,
        functionName: 'balanceOf',
        abi: nabeezonAbi,
        params: {
          account: currentAccount,
        },
      }

      if (isWeb3Enabled) {
        const response = await Moralis.executeFunction(options)
        console.log(response.toString())
        setBalance(response.toString())
      }
    } catch (error) {
      console.log(error)
    }
  }

  const buyAsset = async (price, asset) => {
    try {
      if (!isAuthenticated) return
      console.log('price: ', price)
      console.log('asset: ', asset.name)
      console.log(userData)

      const options = {
        type: 'erc20',
        amount: price,
        receiver: nabeezonCoinAddress,
        contractAddress: nabeezonCoinAddress,
      }

      let transaction = await Moralis.transfer(options)
      const receipt = await transaction.wait()

      if (receipt) {
        

        const res = userData[0].add('ownedAsset', {
          ...asset,
          purchaseDate: Date.now(),
          etherscanLink: `https://ropsten.etherscan.io/tx/${receipt.transactionHash}`,
        })

        await res.save().then(() => {
          alert("You've successfully purchased this asset!")
        })
      }
    } catch (error) {
      console.log(error.message)
    }
  }

  const getAssets = async () => {
    try {
      await enableWeb3()
      

      setAssets(assetsData)
    } catch (error) {
      console.log(error)
    }
  }

  const listenToUpdates = async () => {
    let query = new Moralis.Query('EthTransactions')
    let subscription = await query.subscribe()
    subscription.on('update', async object => {
      console.log('New Transactions')
      console.log(object)
      setRecentTransactions([object])
    })
  }

  const getOwnedAssets = async () => {
    try {
      

      if (userData[0]) {
        setOwnedItems(prevItems => [
          ...prevItems,
          userData[0].attributes.ownedAsset,
        ])
      }
    } catch (error) {
      console.log(error)
    }
  }

  return (
    <NabeezonContext.Provider
      value={{
        formattedAccount,
        isAuthenticated,
        buyTokens,
        getBalance,
        balance,
        setTokenAmount,
        tokenAmount,
        amountDue,
        setAmountDue,
        isLoading,
        setIsLoading,
        setEtherscanLink,
        etherscanLink,
        buyAsset,
        currentAccount,
        nickname,
        setNickname,
        username,
        setUsername,
        handleSetUsername,
        assets,
        recentTransactions,
        ownedItems,
      }}
    >
      {children}
    </NabeezonContext.Provider>
  )
}