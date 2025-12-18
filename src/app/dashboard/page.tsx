import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DataTableClient } from "@/components/data-table-client"

type ApiResponse<T> = {
  success: boolean
  data: T
  timestamp?: string
}

// /api/user
export type UserRow = {
  id: number
  email: string
  first_name: string
  last_name: string
  phone: string | null
  is_active: boolean
}

// /api/user/table
export type TradingRequestRow = {
  id: number
  email: string
  first_name: string
  last_name: string
  UserBalance: { available_balance: string } | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export default async function Page() {
  // fetch server lần đầu
  const [usersRes, requestsRes] = await Promise.all([
    fetchJson<ApiResponse<UserRow[]>>(`${API_BASE}/api/user`),
    fetchJson<ApiResponse<TradingRequestRow[]>>(`${API_BASE}/api/user/table`),
  ])

  const users = usersRes?.success ? usersRes.data : []
  const initialRequests = requestsRes?.success ? requestsRes.data : []

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
              </div>

              {/* ✅ client polling requests mỗi 30s */}
              <DataTableClient
                users={users}
                initialRequests={initialRequests}
                apiBase={API_BASE}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
