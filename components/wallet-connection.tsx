"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap } from "lucide-react"

export function WalletConnection() {
  const { publicKey } = useWallet()

  return (
    <div className="mb-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            钱包连接
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WalletMultiButton className="!bg-primary !text-primary-foreground hover:!bg-primary/90" />
          {publicKey && (
            <p className="mt-2 text-sm text-muted-foreground">
              已连接: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
