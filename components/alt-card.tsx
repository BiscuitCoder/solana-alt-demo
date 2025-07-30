"use client"

import { useState, useCallback } from "react"
import { PublicKey, Transaction, AddressLookupTableProgram } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Eye, Plus, Trash2, RefreshCw, Loader2, AlertTriangle } from "lucide-react"
import { AddressSelector } from "@/components/address-selector"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ALTCardProps {
  alt: {
    address: string
    addresses: PublicKey[]
  }
  index: number
  onRefresh: () => void
  onStatusChange: (status: string) => void
}

export function ALTCard({ alt, index, onRefresh, onStatusChange }: ALTCardProps) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newAddressCount, setNewAddressCount] = useState<number>(5)
  const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(new Set())

  // 生成随机地址
  const generateRandomAddresses = useCallback((count: number) => {
    const addresses = []
    for (let i = 0; i < count; i++) {
      addresses.push(new PublicKey(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))))
    }
    return addresses
  }, [])

  // 向 ALT 添加新地址
  const addAddressesToALT = useCallback(async () => {
    if (!publicKey) return

    setIsLoading(true)
    onStatusChange(`向 ALT 添加 ${newAddressCount} 个新地址...`)

    try {
      const newAddresses = generateRandomAddresses(newAddressCount)
      const lookupTableAddress = new PublicKey(alt.address)

      // 创建扩展指令
      const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: publicKey,
        authority: publicKey,
        lookupTable: lookupTableAddress,
        addresses: newAddresses,
      })

      const transaction = new Transaction().add(extendInstruction)
      const signature = await sendTransaction(transaction, connection)

      await connection.confirmTransaction(signature, "confirmed")

      onStatusChange(`成功向 ALT 添加 ${newAddressCount} 个新地址!`)
      onRefresh() // 刷新 ALT 数据
    } catch (error) {
      console.error("添加地址失败:", error)
      onStatusChange("添加地址失败: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [
    publicKey,
    connection,
    sendTransaction,
    alt.address,
    newAddressCount,
    generateRandomAddresses,
    onStatusChange,
    onRefresh,
  ])

  // 关闭 ALT（删除整个 ALT）
  const closeALT = useCallback(async () => {
    if (!publicKey) return

    const confirmed = window.confirm(
      "确定要关闭这个 Address Lookup Table 吗？\n\n注意：\n- 这将永久删除整个 ALT\n- 无法恢复\n- 会回收租金到您的账户",
    )

    if (!confirmed) return

    setIsLoading(true)
    onStatusChange("关闭 Address Lookup Table...")

    try {
      const lookupTableAddress = new PublicKey(alt.address)

      // 首先需要冻结 ALT
      const freezeInstruction = AddressLookupTableProgram.freezeLookupTable({
        lookupTable: lookupTableAddress,
        authority: publicKey,
      })

      // 然后关闭 ALT
      const closeInstruction = AddressLookupTableProgram.closeLookupTable({
        lookupTable: lookupTableAddress,
        authority: publicKey,
        recipient: publicKey,
      })

      const transaction = new Transaction().add(freezeInstruction, closeInstruction)
      const signature = await sendTransaction(transaction, connection)

      await connection.confirmTransaction(signature, "confirmed")

      onStatusChange("Address Lookup Table 已成功关闭!")
      onRefresh() // 刷新列表
    } catch (error) {
      console.error("关闭 ALT 失败:", error)
      onStatusChange("关闭 ALT 失败: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, sendTransaction, alt.address, onStatusChange, onRefresh])

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">ALT #{index + 1}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{alt.addresses.length} 个地址</Badge>
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs font-mono text-muted-foreground break-all">{alt.address}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            <Eye className="h-4 w-4 mr-1" />
            {isExpanded ? "隐藏地址" : "查看地址"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)} disabled={isExpanded}>
            <Plus className="h-4 w-4 mr-1" />
            添加地址
          </Button>

          <Button variant="destructive" size="sm" onClick={closeALT} disabled={isLoading}>
            <Trash2 className="h-4 w-4 mr-1" />
            关闭 ALT
          </Button>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            <Separator />

            {/* 添加新地址 */}
            <div className="p-4 bg-blue-50 rounded-lg space-y-3">
              <h5 className="font-semibold text-sm">添加新地址</h5>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor={`newAddressCount-${index}`} className="text-xs">
                    新地址数量
                  </Label>
                  <Input
                    id={`newAddressCount-${index}`}
                    type="number"
                    min="1"
                    max="20"
                    value={newAddressCount}
                    onChange={(e) => setNewAddressCount(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <Button onClick={addAddressesToALT} disabled={isLoading} size="sm">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      添加
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">将生成 {newAddressCount} 个随机地址并添加到此 ALT</p>
            </div>

            {/* 地址选择器 */}
            <AddressSelector
              addresses={alt.addresses}
              selectedAddresses={selectedAddresses}
              onSelectionChange={setSelectedAddresses}
              altAddress={alt.address}
              onStatusChange={onStatusChange}
            />

            {/* 删除说明 */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>注意：</strong> Solana ALT 不支持删除单个地址。如需移除地址，只能关闭整个 ALT。 关闭 ALT 会：
                <ul className="mt-1 ml-4 list-disc">
                  <li>永久删除整个 Address Lookup Table</li>
                  <li>回收租金到您的账户</li>
                  <li>无法恢复，请谨慎操作</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
