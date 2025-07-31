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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [altAddress, setAltAddress] = useState("")

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
              lamports: 0.001 * LAMPORTS_PER_SOL,
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
    if (!altAddress.trim()) return { maxAddresses: 0, error: "请输入 ALT 地址" }

    try {
      // 验证 ALT 地址格式
      let altPublicKey: PublicKey
      try {
        altPublicKey = new PublicKey(altAddress.trim())
      } catch {
        return { maxAddresses: 0, error: "ALT 地址格式无效" }
      }

      // 查询 ALT 账户信息
      const lookupTableAccount = await connection.getAddressLookupTable(altPublicKey)

      if (!lookupTableAccount.value) {
        return { 
          maxAddresses: 0, 
          error: "找不到指定的 Address Lookup Table，请检查地址是否正确" 
        }
      }

      // 检查权限
      if (!lookupTableAccount.value.state.authority?.equals(publicKey)) {
        return { 
          maxAddresses: 0, 
          error: "您不是这个 ALT 的权限所有者，无法使用此 ALT 进行测试" 
        }
      }

      const altAddresses = lookupTableAccount.value.state.addresses
      
      if (altAddresses.length === 0) {
        return { 
          maxAddresses: 0, 
          error: "ALT 中没有地址，请先向 ALT 中添加地址" 
        }
      }

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
  }, [publicKey, connection, generateRandomAddresses, altAddress])

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
        <div className="text-sm text-red-400">单从序列化之后的字节来看，似乎 ALT 交易反而多一些，不知道是不是内部执行的时候不同!</div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="alt-address">ALT 地址</Label>
            <Input
              id="alt-address"
              placeholder="输入您的 Address Lookup Table 地址"
              value={altAddress}
              onChange={(e) => setAltAddress(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground">
              请输入您已创建的 Address Lookup Table 地址进行测试
            </p>
          </div>
        </div>

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
            <h4 className="font-semibold mb-2">使用说明</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 请先在"创建 ALT"组件中创建一个 Address Lookup Table</li>
              <li>• 向 ALT 中添加一些地址</li>
              <li>• 复制 ALT 地址并粘贴到上面的输入框中</li>
              <li>• 点击测试按钮开始对比测试</li>
            </ul>
          </div>

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
