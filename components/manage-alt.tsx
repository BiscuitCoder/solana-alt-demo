"use client"

import { useState, useCallback } from "react"
import { PublicKey, AddressLookupTableProgram } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, Loader2 } from "lucide-react"
import { ALTCard } from "@/components/alt-card"

interface ManageALTProps {
  onStatusChange: (status: string) => void
}

interface ALTData {
  address: string
  addresses: PublicKey[]
}

export function ManageALT({ onStatusChange }: ManageALTProps) {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [userALTs, setUserALTs] = useState<ALTData[]>([])
  const [isLoadingALTs, setIsLoadingALTs] = useState(false)

  // 查询用户创建的所有 ALT
  const fetchUserALTs = useCallback(async () => {
    if (!publicKey) return

    setIsLoadingALTs(true)
    onStatusChange("查询您创建的 Address Lookup Tables...")

    try {
      // 获取用户作为 authority 的所有 ALT 账户
      console.log('AddressLookupTableProgram.programId==>',AddressLookupTableProgram.programId.toBase58());
      const accounts = await connection.getProgramAccounts(AddressLookupTableProgram.programId, {
        filters: [
          {
            memcmp: {
              offset: 22, // authority 字段的偏移量
              bytes: publicKey.toBase58(),
            },
          },
        ],
      })

      console.log('accounts==>',accounts);

      const alts = []
      for (const account of accounts) {
        try {
          const lookupTableAccount = await connection.getAddressLookupTable(account.pubkey)
          if (lookupTableAccount.value) {
            alts.push({
              address: account.pubkey.toBase58(),
              addresses: lookupTableAccount.value.state.addresses,
            })
          }
        } catch (error) {
          console.warn(`Failed to fetch ALT ${account.pubkey.toBase58()}:`, error)
        }
      }

      setUserALTs(alts)
      onStatusChange(`找到 ${alts.length} 个 Address Lookup Tables`)
    } catch (error) {
      console.error("查询 ALT 失败:", error)
      onStatusChange("查询 ALT 失败: " + (error as Error).message)
    } finally {
      setIsLoadingALTs(false)
    }
  }, [publicKey, connection, onStatusChange])

  // 刷新单个 ALT 数据
  const refreshALT = useCallback(
    async (altAddress: string) => {
      try {
        const lookupTableAccount = await connection.getAddressLookupTable(new PublicKey(altAddress))
        if (lookupTableAccount.value) {
          setUserALTs((prev) =>
            prev.map((alt) =>
              alt.address === altAddress ? { ...alt, addresses: lookupTableAccount.value!.state.addresses } : alt,
            ),
          )
        }
      } catch (error) {
        console.error("刷新 ALT 失败:", error)
        onStatusChange("刷新 ALT 失败: " + (error as Error).message)
      }
    },
    [connection, onStatusChange],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          我的 Address Lookup Tables
        </CardTitle>
        <CardDescription>查询和管理您创建的所有 Address Lookup Tables</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={fetchUserALTs} disabled={isLoadingALTs} className="w-full mb-4">
          {isLoadingALTs ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              查询中...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              查询我的 ALTs
            </>
          )}
        </Button>

        {userALTs.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-semibold">找到 {userALTs.length} 个 Address Lookup Tables:</h4>

            {userALTs.map((alt, index) => (
              <ALTCard
                key={alt.address}
                alt={alt}
                index={index}
                onRefresh={() => refreshALT(alt.address)}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
