"use client"

import * as React from "react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table"
import type { UserRow, TradingRequestRow } from "@/app/dashboard/page"

type ApiResponse<T> = {
  success: boolean
  data: T
  timestamp?: string
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export function DataTableClient({
  users,
  initialRequests,
  apiBase,
}: {
  users: UserRow[]
  initialRequests: TradingRequestRow[]
  apiBase: string
}) {
  const [requests, setRequests] = React.useState<TradingRequestRow[]>(initialRequests)

  React.useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetchJson<ApiResponse<TradingRequestRow[]>>(
          `${apiBase}/api/user/table`,
          controller.signal
        )
        if (!mounted) return
        setRequests(res?.success ? res.data : [])
      } catch (e: any) {
        if (e?.name === "AbortError") return
        toast.error(e?.message ?? "Failed to refresh trading requests")
      }
    }

    // ✅ refresh ngay khi mount
    load()

    // ✅ refresh mỗi 30s
    const t = setInterval(load, 30_000)

    return () => {
      mounted = false
      controller.abort()
      clearInterval(t)
    }
  }, [apiBase])

  return (
    <DataTable
      data={{
        users,
        requests,
      }}
    />
  )
}
