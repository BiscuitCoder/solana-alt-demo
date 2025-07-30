"use client"

import { useState, useCallback } from "react"
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Loader2 } from "lucide-react"

interface AddressLimitTestProps {
  onStatusChange: (status: string) => void
}

export function AddressLimitTest({ onStatusChange }: AddressLimitTestProps) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [addressLimitTest, setAddressLimitTest] = useState<{
    maxAddresses: number
    error: string | null
  }>({ maxAddresses: 0, error: null })

  // 生成随机地址
  const generateRandomAddresses = useCallback(() => {
    const addresses = []
    for (let i = 0; i < 50; i++) {
      addresses.push(new PublicKey(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))))
    }
    return addresses
  }, [])

  // 测试普通交易的地址限制
  const testAddressLimit = useCallback(async () => {
    if (!publicKey) return

    setIsLoading(true)
    onStatusChange("测试普通交易地址限制...")

    try {
      const addresses = generateRandomAddresses()
      let maxAddresses = 0
      let error = null

      // 逐步增加地址数量，直到交易失败
      for (let count = 1; count <= 50; count++) {
        try {
          const instructions = []

          for (let i = 0; i < count; i++) {
            instructions.push(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: addresses[i],
                lamports: 1000,
              }),
            )
          }

          const transaction = new Transaction().add(...instructions)
          const { blockhash } = await connection.getLatestBlockhash()
          transaction.recentBlockhash = blockhash
          transaction.feePayer = publicKey

          // 尝试编译交易消息
          const message = transaction.compileMessage()

          // 检查交易大小是否超过限制
          if (message.serialize().length > 1232) {
            // Solana 交易大小限制
            error = `交易大小超过限制 (${message.serialize().length} bytes > 1232 bytes)`
            break
          }

          maxAddresses = count
        } catch (err) {
          error = (err as Error).message
          break
        }
      }

      setAddressLimitTest({ maxAddresses, error })
      onStatusChange(`普通交易最多支持 ${maxAddresses} 个地址`)
    } catch (error) {
      console.error("地址限制测试失败:", error)
      onStatusChange("地址限制测试失败: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, connection, generateRandomAddresses, onStatusChange])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          普通交易地址限制测试
        </CardTitle>
        <CardDescription>测试普通交易能够包含的最大地址数量，验证 ALT 的必要性</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={testAddressLimit} disabled={isLoading} className="w-full mb-4">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              测试中...
            </>
          ) : (
            "开始地址限制测试"
          )}
        </Button>

        {addressLimitTest.maxAddresses > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>
                  <strong>测试结果:</strong> 普通交易最多支持 <strong>{addressLimitTest.maxAddresses}</strong> 个地址
                </p>
                {addressLimitTest.error && (
                  <p className="text-red-600">
                    <strong>限制原因:</strong> {addressLimitTest.error}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  这证明了 Address Lookup Tables 的重要性：当需要与大量地址交互时， ALT
                  可以突破普通交易的地址数量限制，同时还能节省交易费用。
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold mb-2">为什么存在地址限制？</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Solana 交易大小限制为 1232 字节</li>
              <li>• 每个地址占用 32 字节</li>
              <li>• 交易还需要包含指令、签名等其他数据</li>
              <li>• ALT 通过索引引用地址，每个索引只占 1 字节</li>
              <li>• 这使得 ALT 交易可以包含更多地址</li>
            </ul>
          </div>

          <Separator />

          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold mb-2">ALT 的优势</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 突破地址数量限制（可包含数百个地址）</li>
              <li>• 显著减少交易费用（20-60% 节省）</li>
              <li>• 提高网络效率和吞吐量</li>
              <li>• 特别适合 DeFi、批量操作等场景</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
