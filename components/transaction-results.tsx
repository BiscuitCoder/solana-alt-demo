"use client"

import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ExternalLink } from "lucide-react"

interface TransactionResultsProps {
  normalTxSignature: string
  altTxSignature: string
  normalTxFee: number
  altTxFee: number
  feeComparison: {
    savings: number
    savingsPercentage: string
  } | null
}

export function TransactionResults({
  normalTxSignature,
  altTxSignature,
  normalTxFee,
  altTxFee,
  feeComparison,
}: TransactionResultsProps) {
  return (
    <>
      {/* 交易结果表格 */}
      {(normalTxSignature || altTxSignature) && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>交易类型</TableHead>
              <TableHead>费用 (SOL)</TableHead>
              <TableHead>交易签名</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {normalTxSignature && (
              <TableRow>
                <TableCell>普通交易</TableCell>
                <TableCell>
                  <Badge variant="destructive">{(normalTxFee / LAMPORTS_PER_SOL).toFixed(6)}</Badge>
                </TableCell>
                <TableCell>
                  <a
                    href={`https://explorer.solana.com/tx/${normalTxSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    查看 <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              </TableRow>
            )}
            {altTxSignature && (
              <TableRow>
                <TableCell>ALT 交易</TableCell>
                <TableCell>
                  <Badge variant="secondary">{(altTxFee / LAMPORTS_PER_SOL).toFixed(6)}</Badge>
                </TableCell>
                <TableCell>
                  <a
                    href={`https://explorer.solana.com/tx/${altTxSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    查看 <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* 费用比较结果 */}
      {feeComparison && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">💰 费用节省分析</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-muted-foreground">普通交易费用</p>
                <p className="text-lg font-bold text-red-600">{(normalTxFee / LAMPORTS_PER_SOL).toFixed(6)} SOL</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-muted-foreground">ALT 交易费用</p>
                <p className="text-lg font-bold text-green-600">{(altTxFee / LAMPORTS_PER_SOL).toFixed(6)} SOL</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-muted-foreground">节省费用</p>
                <p className="text-lg font-bold text-blue-600">{feeComparison.savingsPercentage}%</p>
                <p className="text-xs text-muted-foreground">
                  ({(feeComparison.savings / LAMPORTS_PER_SOL).toFixed(6)} SOL)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
