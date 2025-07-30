"use client"

import { useState, useCallback, useMemo } from "react"
import {
  PublicKey,
  Transaction,
  SystemProgram,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { TransactionResults } from "@/components/transaction-results"

interface CompareTransactionsProps {
  onStatusChange: (status: string) => void
}

export function CompareTransactions({ onStatusChange }: CompareTransactionsProps) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [normalTxFee, setNormalTxFee] = useState<number>(0)
  const [altTxFee, setAltTxFee] = useState<number>(0)
  const [normalTxSignature, setNormalTxSignature] = useState<string>("")
  const [altTxSignature, setAltTxSignature] = useState<string>("")

  // 生成随机地址
  const generateRandomAddresses = useCallback(() => {
    const addresses = []
    for (let i = 0; i < 20; i++) {
      addresses.push(new PublicKey(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))))
    }
    return addresses
  }, [])

  // 发送普通交易
  const sendNormalTransaction = useCallback(async () => {
    if (!publicKey) return

    setIsLoading(true)
    onStatusChange("发送普通交易...")

    try {
      const addresses = generateRandomAddresses()
      const instructions = []

      for (let i = 0; i < 10; i++) {
        console.log(addresses[i].toBase58());
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: addresses[i],
            lamports: 0.001 ** LAMPORTS_PER_SOL,
          }),
        )
      }

      const transaction = new Transaction().add(...instructions)
      const { blockhash } = await connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const fee = await connection.getFeeForMessage(transaction.compileMessage())
      setNormalTxFee(fee?.value || 0)

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "confirmed")

      setNormalTxSignature(signature)
      onStatusChange("普通交易发送成功!")
    } catch (error) {
      console.error("普通交易失败:", error)
      onStatusChange("普通交易失败: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, sendTransaction, generateRandomAddresses, onStatusChange])

  // 发送 ALT 交易（创建临时 ALT）
  const sendALTTransaction = useCallback(async () => {
    if (!publicKey) return

    setIsLoading(true)
    onStatusChange("创建临时 ALT 并发送交易...")

    try {
      const addresses = generateRandomAddresses()

      // 创建临时 ALT
      const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
        authority: publicKey,
        payer: publicKey,
        recentSlot: await connection.getSlot(),
      })

      const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: publicKey,
        authority: publicKey,
        lookupTable: lookupTableAddress,
        addresses: addresses.slice(0, 10),
      })

      // 先创建 ALT
      const createTransaction = new Transaction().add(lookupTableInst, extendInstruction)
      const createSignature = await sendTransaction(createTransaction, connection)
      await connection.confirmTransaction(createSignature, "confirmed")

      // 等待一个 slot 让 ALT 生效
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 获取 ALT 账户信息
      const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress)

      if (!lookupTableAccount.value) {
        throw new Error("找不到刚创建的 Address Lookup Table")
      }

      const altAddresses = lookupTableAccount.value.state.addresses
      const instructions = []

      for (let i = 0; i < Math.min(10, altAddresses.length); i++) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: altAddresses[i],
            lamports: 0.001 * LAMPORTS_PER_SOL,
          }),
        )
      }

      const { blockhash } = await connection.getLatestBlockhash()

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message([lookupTableAccount.value])

      const fee = await connection.getFeeForMessage(messageV0)
      setAltTxFee(fee?.value || 0)

      const transaction = new VersionedTransaction(messageV0)
      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "confirmed")

      setAltTxSignature(signature)
      onStatusChange("ALT 交易发送成功!")
    } catch (error) {
      console.error("ALT 交易失败:", error)
      onStatusChange("ALT 交易失败: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, sendTransaction, generateRandomAddresses, onStatusChange])

  const feeComparison = useMemo(() => {
    if (normalTxFee && altTxFee) {
      const savings = normalTxFee - altTxFee
      const savingsPercentage = ((savings / normalTxFee) * 100).toFixed(1)
      return { savings, savingsPercentage }
    }
    return null
  }, [normalTxFee, altTxFee])

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易费用比较</CardTitle>
        <CardDescription>比较普通交易和 ALT 交易的费用差异</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={sendNormalTransaction}
            disabled={isLoading}
            variant="outline"
            className="h-20 bg-transparent"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                发送中...
              </>
            ) : (
              <div className="text-center">
                <div className="font-semibold">发送普通交易</div>
                <div className="text-xs text-muted-foreground">不使用 ALT</div>
              </div>
            )}
          </Button>

          <Button onClick={sendALTTransaction} disabled={isLoading} variant="outline" className="h-20 bg-transparent">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                发送中...
              </>
            ) : (
              <div className="text-center">
                <div className="font-semibold">发送 ALT 交易</div>
                <div className="text-xs text-muted-foreground">使用 ALT</div>
              </div>
            )}
          </Button>
        </div>

        <TransactionResults
          normalTxSignature={normalTxSignature}
          altTxSignature={altTxSignature}
          normalTxFee={normalTxFee}
          altTxFee={altTxFee}
          feeComparison={feeComparison}
        />
      </CardContent>
    </Card>
  )
}
