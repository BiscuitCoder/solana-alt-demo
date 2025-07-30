"use client"

import { useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WalletConnection } from "@/components/wallet-connection"
import { CreateALT } from "@/components/create-alt"
import { ManageALT } from "@/components/manage-alt"
import { CompareTransactions } from "@/components/compare-transactions"
import { AddressLimitTest } from "@/components/address-limit-test"

export default function SolanaALTDemo() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [status, setStatus] = useState<string>("")

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Solana Address Lookup Tables 演示</h1>
        <p className="text-muted-foreground">比较使用和不使用 Address Lookup Tables 的交易费用差异</p>
      </div>

      <WalletConnection />

      {publicKey && (
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="create">创建 ALT</TabsTrigger>
            <TabsTrigger value="manage">管理 ALT</TabsTrigger>
            <TabsTrigger value="compare">费用比较</TabsTrigger>
            <TabsTrigger value="limits">地址限制测试</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <CreateALT onStatusChange={setStatus} />
          </TabsContent>

          <TabsContent value="manage">
            <ManageALT onStatusChange={setStatus} />
          </TabsContent>

          <TabsContent value="compare">
            <CompareTransactions onStatusChange={setStatus} />
          </TabsContent>

          <TabsContent value="limits">
            <AddressLimitTest onStatusChange={setStatus} />
          </TabsContent>
        </Tabs>
      )}

      {/* 状态显示 */}
      {status && (
        <Alert className="mt-6">
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
