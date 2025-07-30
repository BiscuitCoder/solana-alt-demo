"use client"

import { useState, useCallback } from "react"
import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, Loader2, TrendingUp } from "lucide-react"

interface AddressLimitTestProps {
  onStatusChange: (status: string) => void
}

interface TestResult {
  maxAddresses: number
  error: string | null
}

export function AddressLimitTest({ onStatusChange }: AddressLimitTestProps) {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [normalTestResult, setNormalTestResult] = useState<TestResult>({ maxAddresses: 0, error: null })
  const [altTestResult, setAltTestResult] = useState<TestResult>({ maxAddresses: 0, error: null })

  // 生成随机地址
  const generateRandomAddresses = useCallback((count: number) => {
    const addresses = []
    for (let i = 0; i < count; i++) {
      addresses.push(new PublicKey(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))))
    }
    return addresses
  }, [])

  // 测试普通交易的地址限制
  const testNormalTransactionLimit = useCallback(async (): Promise<TestResult> => {
    if (!publicKey) return { maxAddresses: 0, error: "未连接钱包" }

    const addresses = generateRandomAddresses(100)
    let maxAddresses = 0
    let error = null

    // 逐步增加地址数量，直到交易失败
    for (let count = 1; count <= 100; count++) {
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
          error = `交易大小超过限制 (${message.serialize().length} bytes > 1232 bytes)`
          break
        }

        maxAddresses = count
      } catch (err) {
        error = (err as Error).message
        break
      }
    }

    return { maxAddresses, error }
  }, [publicKey, connection, generateRandomAddresses])

  // 测试 ALT 交易的地址限制
  const testALTTransactionLimit = useCallback(async (): Promise<TestResult> => {
    if (!publicKey) return { maxAddresses: 0, error: "未连接钱包" }

    try {
      // 创建临时 ALT
      const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
        authority: publicKey,
        payer: publicKey,
        recentSlot: await connection.getSlot(),
      })

      const addresses = generateRandomAddresses(256) // ALT 最多支持 256 个地址

      const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        payer: publicKey,
        authority: publicKey,
        lookupTable: lookupTableAddress,
        addresses: addresses,
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
      let maxAddresses = 0
      let error = null

      // 测试 ALT 交易能包含的最大地址数量
      for (let count = 1; count <= Math.min(256, altAddresses.length); count++) {
        try {
          const instructions = []

          for (let i = 0; i < count; i++) {
            instructions.push(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: altAddresses[i],
                lamports: 1000,
              }),
            )
          }

          const { blockhash } = await connection.getLatestBlockhash()

          const messageV0 = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: blockhash,
            instructions,
          }).compileToV0Message([lookupTableAccount.value])

          // 检查交易大小是否超过限制
          if (messageV0.serialize().length > 1232) {
            error = `ALT 交易大小超过限制 (${messageV0.serialize().length} bytes > 1232 bytes)`
            break
          }

          maxAddresses = count
        } catch (err) {
          error = (err as Error).message
          break
        }
      }

      return { maxAddresses, error }
    } catch (error) {
      return { maxAddresses: 0, error: (error as Error).message }
    }
  }, [publicKey, connection, sendTransaction, generateRandomAddresses])

  // 开始地址限制测试
  const testAddressLimit = useCallback(async () => {
    if (!publicKey) return

    setIsLoading(true)
    onStatusChange("开始测试普通交易和 ALT 交易的地址限制...")

    try {
      // 并行测试普通交易和 ALT 交易
      onStatusChange("测试普通交易地址限制...")
      const normalResult = await testNormalTransactionLimit()
      setNormalTestResult(normalResult)

      onStatusChange("测试 ALT 交易地址限制...")
      const altResult = await testALTTransactionLimit()
      setAltTestResult(altResult)

      if (normalResult.maxAddresses > 0 && altResult.maxAddresses > 0) {
        const improvement = altResult.maxAddresses - normalResult.maxAddresses
        const improvementPercentage = ((improvement / normalResult.maxAddresses) * 100).toFixed(1)
        onStatusChange(`测试完成！ALT 比普通交易多支持 ${improvement} 个地址 (提升 ${improvementPercentage}%)`)
      } else {
        onStatusChange("测试完成！")
      }
    } catch (error) {
      console.error("地址限制测试失败:", error)
      onStatusChange("地址限制测试失败: " + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [publicKey, testNormalTransactionLimit, testALTTransactionLimit, onStatusChange])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          交易地址限制对比测试
        </CardTitle>
        <CardDescription>对比测试普通交易和 ALT 交易能够包含的最大地址数量</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={testAddressLimit} disabled={isLoading} className="w-full mb-4">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              测试中...
            </>
          ) : (
            "开始地址限制对比测试"
          )}
        </Button>

        {(normalTestResult.maxAddresses > 0 || altTestResult.maxAddresses > 0) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 普通交易结果 */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">普通交易限制</p>
                    <p>
                      最多支持 <strong>{normalTestResult.maxAddresses}</strong> 个地址
                    </p>
                    {normalTestResult.error && (
                      <p className="text-red-600 text-sm">
                        限制原因: {normalTestResult.error}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {/* ALT 交易结果 */}
              <Alert>
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">ALT 交易限制</p>
                    <p>
                      最多支持 <strong>{altTestResult.maxAddresses}</strong> 个地址
                    </p>
                    {altTestResult.error && (
                      <p className="text-red-600 text-sm">
                        限制原因: {altTestResult.error}
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>

            {/* 对比结果 */}
            {normalTestResult.maxAddresses > 0 && altTestResult.maxAddresses > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold text-green-800">ALT 优势对比</p>
                    <p className="text-green-700">
                      ALT 比普通交易多支持 <strong>{altTestResult.maxAddresses - normalTestResult.maxAddresses}</strong> 个地址
                    </p>
                    <p className="text-green-700">
                      提升幅度: <strong>{((altTestResult.maxAddresses - normalTestResult.maxAddresses) / normalTestResult.maxAddresses * 100).toFixed(1)}%</strong>
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
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
