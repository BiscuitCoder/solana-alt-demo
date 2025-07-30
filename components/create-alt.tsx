"use client"

import { useState, useCallback } from "react"
import { PublicKey, Transaction, AddressLookupTableProgram } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface CreateALTProps {
  onStatusChange: (status: string) => void
}

export function CreateALT({ onStatusChange }: CreateALTProps) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [altAddress, setAltAddress] = useState<string>("")
  const [addressCount, setAddressCount] = useState<number>(10)

  // 生成随机地址
  const generateRandomAddresses = useCallback((count: number) => {
    const addresses = []
    for (let i = 0; i < count; i++) {
      addresses.push(new PublicKey(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))))
    }
    return addresses
  }, [])

  // 创建 Address Lookup Table
  const createAddressLookupTable = useCallback(async () => {
    if (!publicKey) return null

    setIsLoading(true)
    onStatusChange("创建 Address Lookup Table...")

    try {
      const addresses = generateRandomAddresses(addressCount)

      // 创建 ALT
      const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
        authority: publicKey,
        payer: publicKey,
        recentSlot: await connection.getSlot(),
      })

      // 扩展 ALT 添加地址
      const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: publicKey,
        authority: publicKey,
        lookupTable: lookupTableAddress,
        addresses: addresses,
      })

      const transaction = new Transaction().add(lookupTableInst, extendInstruction)
      const signature = await sendTransaction(transaction, connection)

      await connection.confirmTransaction(signature, "confirmed")

      setAltAddress(lookupTableAddress.toBase58())
      onStatusChange(`Address Lookup Table 创建成功! 包含 ${addressCount} 个地址`)

      return lookupTableAddress
    } catch (error) {
      console.error("创建 ALT 失败:", error)
      onStatusChange("创建 ALT 失败: " + (error as Error).message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, sendTransaction, generateRandomAddresses, addressCount, onStatusChange])

  return (
    <Card>
      <CardHeader>
        <CardTitle>创建 Address Lookup Table</CardTitle>
        <CardDescription>创建一个包含指定数量地址的 Address Lookup Table</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="addressCount">初始地址数量</Label>
          <Input
            id="addressCount"
            type="number"
            min="1"
            max="50"
            value={addressCount}
            onChange={(e) => setAddressCount(Number(e.target.value))}
            placeholder="输入要创建的地址数量"
          />
          <p className="text-xs text-muted-foreground">建议: 1-50 个地址，过多可能导致交易失败</p>
        </div>

        <Button onClick={createAddressLookupTable} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              创建中...
            </>
          ) : (
            `创建包含 ${addressCount} 个地址的 ALT`
          )}
        </Button>

        {altAddress && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">新创建的 ALT 地址:</p>
            <p className="text-xs font-mono break-all">{altAddress}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
