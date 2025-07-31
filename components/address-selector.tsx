"use client"

import { useState, useCallback } from "react"
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, Transaction } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckSquare, Loader2, AlertTriangle, X } from "lucide-react"

interface AddressSelectorProps {
  addresses: PublicKey[]
  selectedAddresses: Set<string>
  onSelectionChange: (addresses: Set<string>) => void
  altAddress: string
  onStatusChange: (status: string) => void
}

export function AddressSelector({
  addresses,
  selectedAddresses,
  onSelectionChange,
  altAddress,
  onStatusChange,
}: AddressSelectorProps) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 处理地址选择
  const handleAddressSelection = useCallback(
    (address: string, checked: boolean) => {
      const newSet = new Set(selectedAddresses)
      if (checked) {
        newSet.add(address)
      } else {
        newSet.delete(address)
      }
      onSelectionChange(newSet)
    },
    [selectedAddresses, onSelectionChange],
  )

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (selectedAddresses.size === addresses.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(addresses.map((addr) => addr.toBase58())))
    }
  }, [selectedAddresses.size, addresses, onSelectionChange])

  // 使用选中的地址发送 ALT 交易
  const sendSelectedAddressALTTransaction = useCallback(async () => {
    if (!publicKey || selectedAddresses.size === 0) return

    setIsLoading(true)
    setError(null)
    onStatusChange("发送选中地址的 ALT 交易...")

    try {
      const lookupTableAddress = new PublicKey(altAddress)
      const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress)

      console.log('lookupTableAccount==>',lookupTableAccount);

      if (!lookupTableAccount.value) {
        throw new Error("找不到 Address Lookup Table")
      }

      const instructions = []
      const selectedAddressArray = Array.from(selectedAddresses)

      // 为每个选中的地址创建转账指令
      for (const addressStr of selectedAddressArray) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(addressStr),
            lamports: 0.001 * LAMPORTS_PER_SOL,
          }),
        )
      }

      const { blockhash } = await connection.getLatestBlockhash()

      // 创建 v0 交易消息
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message([lookupTableAccount.value])

      const transaction = new VersionedTransaction(messageV0)
      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "confirmed")

      onStatusChange(`ALT 交易发送成功! 使用了 ${selectedAddresses.size} 个地址`)
    } catch (error) {
      console.error("选中地址 ALT 交易失败:", error)
      const errorMessage = (error as Error).message
      setError(`ALT 交易失败: ${errorMessage}`)
      onStatusChange("选中地址 ALT 交易失败: " + errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, sendTransaction, altAddress, selectedAddresses, onStatusChange])

  // 使用选中的地址发送常规交易
  const sendSelectedAddressNormalTransaction = useCallback(async () => {
    if (!publicKey || selectedAddresses.size === 0) return

    setIsLoading(true)
    setError(null)
    onStatusChange("发送选中地址的常规交易...")

    try {
      const instructions = []
      const selectedAddressArray = Array.from(selectedAddresses)

      // 为每个选中的地址创建转账指令
      for (const addressStr of selectedAddressArray) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(addressStr),
            lamports: 0.001 * LAMPORTS_PER_SOL,
          }),
        )
      }

      const { blockhash } = await connection.getLatestBlockhash()

      // 创建常规交易
      const transaction = new Transaction()
      transaction.add(...instructions)
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, "confirmed")

      onStatusChange(`常规交易发送成功! 使用了 ${selectedAddresses.size} 个地址`)
    } catch (error) {
      console.error("选中地址常规交易失败:", error)
      const errorMessage = (error as Error).message
      setError(`常规交易失败: ${errorMessage}`)
      onStatusChange("选中地址常规交易失败: " + errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, sendTransaction, selectedAddresses, onStatusChange])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-sm">地址列表 ({addresses.length} 个)</h5>
        <Button variant="outline" size="sm" onClick={toggleSelectAll}>
          <CheckSquare className="h-4 w-4 mr-1" />
          {selectedAddresses.size === addresses.length ? "取消全选" : "全选"}
        </Button>
      </div>

      <ScrollArea className="h-64 w-full border rounded-md p-3">
        <div className="space-y-2">
          {addresses.map((address, addrIndex) => (
            <div key={address.toBase58()} className="flex items-center space-x-2">
              <Checkbox
                id={`addr-${altAddress}-${addrIndex}`}
                checked={selectedAddresses.has(address.toBase58())}
                onCheckedChange={(checked) => handleAddressSelection(address.toBase58(), checked as boolean)}
              />
              <label htmlFor={`addr-${altAddress}-${addrIndex}`} className="text-xs font-mono cursor-pointer flex-1">
                {addrIndex + 1}. {address.toBase58()}
              </label>
            </div>
          ))}
        </div>
      </ScrollArea>

      {selectedAddresses.size > 0 && (
        <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">已选择 {selectedAddresses.size} 个地址</span>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={sendSelectedAddressALTTransaction} 
              disabled={isLoading} 
              size="sm"
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发送中...
                </>
              ) : (
                "发送 ALT 交易"
              )}
            </Button>
            
            <Button 
              onClick={sendSelectedAddressNormalTransaction} 
              disabled={isLoading} 
              size="sm"
              variant="outline"
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发送中...
                </>
              ) : (
                "发送常规交易"
              )}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>• ALT 交易：使用 Address Lookup Table，节省费用</p>
            <p>• 常规交易：直接包含地址，适合少量地址</p>
          </div>
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium">交易失败</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 hover:bg-red-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
