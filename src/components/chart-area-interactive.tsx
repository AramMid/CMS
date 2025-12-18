"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/* ---------------- Helpers ---------------- */
function toNumber(v: unknown) {
  const n = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

function formatVNDCompact(value: number) {
  const num = toNumber(value)
  if (num >= 1_000_000_000)
    return `${(num / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B ₫`
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(2).replace(/\.00$/, "")}M ₫`
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(2).replace(/\.00$/, "")}K ₫`
  return `${Math.round(num).toLocaleString("vi-VN")} ₫`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function shiftDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

/**
 * ✅ Fake-but-realistic trading series:
 * - totalBalance: random walk with drift + volatility clustering + occasional shock + mean reversion
 * - activeUsers: fluctuates around a base with small randomness and reacts to shocks
 */
function generateTradingSeries(days: number) {
  // Choose a realistic starting balance (≈ 300M → 1.2B)
  const startBalance =
    (300_000_000 + Math.random() * 900_000_000) * (Math.random() > 0.5 ? 1 : 0.9)

  // Active users baseline (e.g. admin panel)
  const baseUsers = Math.floor(40 + Math.random() * 160) // 40..200

  // Drift (slight growth or decline)
  const drift = (Math.random() - 0.45) * 0.0012 // ~ -0.05%..+0.09% daily

  // Volatility regime
  let vol = FletcherVol(0.004, 0.014) // 0.4%..1.4% daily baseline
  let balance = startBalance
  let activeUsers = baseUsers

  // Mean-reversion anchor (like "fair" equity curve)
  const anchor = startBalance * (0.98 + Math.random() * 0.05) // 98%..103%

  const referenceDate = new Date() // show latest dates
  const startDate = shiftDays(referenceDate, -(days - 1))

  const data: Array<{ date: string; totalBalance: number; activeUsers: number }> =
    []

  for (let i = 0; i < days; i++) {
    const date = shiftDays(startDate, i)

    // Volatility clustering: sometimes volatility increases
    if (Math.random() < 0.18) {
      vol = clamp(vol * (0.85 + Math.random() * 0.7), 0.003, 0.03)
    }

    // Shock event (news, bot cascade, breakout)
    const shock =
      Math.random() < 0.12
        ? (Math.random() > 0.5 ? 1 : -1) * (0.008 + Math.random() * 0.02) // 0.8%..2.8%
        : 0

    // Daily return = drift + random noise + shock
    const noise = gaussian(0, vol)
    let dailyReturn = drift + noise + shock

    // Mean reversion pull towards anchor (prevents endless drift)
    const deviation = (balance - anchor) / anchor
    dailyReturn += -deviation * 0.08 // pull back

    // Apply return
    balance = Math.max(0, balance * (1 + dailyReturn))

    // Active users reacts mildly: shock up => more active, shock down => fewer active
    const userShock = shock !== 0 ? Math.sign(shock) * (1 + Math.random() * 2) : 0
    activeUsers = clamp(
      Math.round(activeUsers + (Math.random() - 0.5) * 6 + userShock),
      Math.max(5, Math.round(baseUsers * 0.6)),
      Math.round(baseUsers * 1.4)
    )

    data.push({
      date: toISODate(date),
      totalBalance: Math.round(balance),
      activeUsers,
    })
  }

  return data
}

/** A small helper to random baseline vol */
function FletcherVol(min: number, max: number) {
  return min + Math.random() * (max - min)
}

/** Box–Muller Gaussian */
function gaussian(mean = 0, std = 1) {
  let u = 0,
    v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + z * std
}

/* ---------------- Chart config ---------------- */
const chartConfig = {
  totalBalance: { label: "Total Balance", color: "var(--primary)" },
  activeUsers: { label: "Active Users", color: "var(--primary)" },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState<"3d" | "5d" | "7d">("7d")

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d")
  }, [isMobile])

  const days = timeRange === "3d" ? 3 : timeRange === "5d" ? 5 : 7

  // ✅ Generate data ONCE per range (and re-gen when range changes)
  const chartData = React.useMemo(() => generateTradingSeries(days), [days])

  const latest = chartData[chartData.length - 1]
  const prev = chartData[chartData.length - 2]
  const delta = latest && prev ? latest.totalBalance - prev.totalBalance : 0
  const deltaPct =
    latest && prev && prev.totalBalance > 0 ? (delta / prev.totalBalance) * 100 : 0

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Trading Overview</CardTitle>
        <CardDescription className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            Balance curve & active users (realistic mock trading dynamics)
          </span>

          {latest ? (
            <span className="text-foreground font-medium">
              Total Balance: {formatVNDCompact(latest.totalBalance)}{" "}
              <span className="text-muted-foreground font-normal">
                ({delta >= 0 ? "+" : ""}
                {formatVNDCompact(delta)} / {deltaPct >= 0 ? "+" : ""}
                {deltaPct.toFixed(2)}%)
              </span>
            </span>
          ) : null}
        </CardDescription>

        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(v) => v && setTimeRange(v as "3d" | "5d" | "7d")}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
            <ToggleGroupItem value="5d">Last 5 days</ToggleGroupItem>
            <ToggleGroupItem value="3d">Last 3 days</ToggleGroupItem>
          </ToggleGroup>

          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 7 days" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
              <SelectItem value="5d" className="rounded-lg">
                Last 5 days
              </SelectItem>
              <SelectItem value="3d" className="rounded-lg">
                Last 3 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillTotalBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalBalance)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-totalBalance)" stopOpacity={0.12} />
              </linearGradient>

              <linearGradient id="fillActiveUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-activeUsers)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-activeUsers)" stopOpacity={0.08} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={18}
              tickFormatter={(value) => {
                const d = new Date(value)
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }}
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }
                  formatter={(value, name) => {
                    if (name === "totalBalance")
                      return [formatVNDCompact(toNumber(value)), "Total Balance"]
                    if (name === "activeUsers") return [String(value), "Active Users"]
                    return [String(value), String(name)]
                  }}
                />
              }
            />

            <Area
              dataKey="totalBalance"
              type="monotone"
              fill="url(#fillTotalBalance)"
              stroke="var(--color-totalBalance)"
              strokeWidth={2}
            />

            <Area
              dataKey="activeUsers"
              type="monotone"
              fill="url(#fillActiveUsers)"
              stroke="var(--color-activeUsers)"
              strokeWidth={1.5}
              opacity={0.65}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
