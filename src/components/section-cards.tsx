"use client"

import * as React from "react"
import { motion, animate } from "framer-motion"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// ----------------------
// Helpers
// ----------------------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function formatVNDCompact(value: number) {
  const num = Number(value)
  if (!Number.isFinite(num)) return "0 ₫"
  const abs = Math.abs(num)

  const sign = num < 0 ? "-" : ""
  const fmt = (v: number) => v.toFixed(2).replace(/\.00$/, "")

  if (abs >= 1_000_000_000) return `${sign}${fmt(abs / 1_000_000_000)}B ₫`
  if (abs >= 1_000_000) return `${sign}${fmt(abs / 1_000_000)}M ₫`
  if (abs >= 1_000) return `${sign}${fmt(abs / 1_000)}K ₫`
  return `${sign}${abs.toLocaleString("vi-VN")} ₫`
}

function formatPct(value: number) {
  return `${value.toFixed(1)}%`
}

/** Animated number text */
function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (v: number) => string
  className?: string
}) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const prev = React.useRef<number>(value)

  React.useEffect(() => {
    if (!ref.current) return
    const controls = animate(prev.current, value, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = format(latest)
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, format])

  return <span ref={ref} className={className} />
}

// ----------------------
// Types
// ----------------------
type BotGroupKey = "mm" | "tf" | "nt"

type GroupStats = {
  activeBots: number
  totalBots: number
  pnlToday: number // VND
  winRate: number // %
  maxDrawdown: number // %
  fillRate: number // %
  change24h: number // %
  health: number // 0..100
}

type UiStats = {
  mm: GroupStats
  tf: GroupStats
  nt: GroupStats
  tradesPerMin: number
  tpmChange: number
}

// ----------------------
// Mock data generator (realistic-ish)
// ----------------------
function makeInitial(): UiStats {
  return {
    mm: {
      totalBots: 15,
      activeBots: 14,
      pnlToday: 3_250_000,
      winRate: 57.8,
      maxDrawdown: 1.9,
      fillRate: 92.5,
      change24h: 6.4,
      health: 88,
    },
    tf: {
      totalBots: 8,
      activeBots: 7,
      pnlToday: 5_800_000,
      winRate: 61.2,
      maxDrawdown: 4.6,
      fillRate: 84.0,
      change24h: 9.1,
      health: 82,
    },
    nt: {
      totalBots: 8,
      activeBots: 8,
      pnlToday: -1_450_000,
      winRate: 47.9,
      maxDrawdown: 6.8,
      fillRate: 73.5,
      change24h: -3.2,
      health: 67,
    },
    tradesPerMin: 128,
    tpmChange: 4.8,
  }
}

function jitterGroup(s: GroupStats, key: BotGroupKey): GroupStats {
  // tailored behavior per bot type
  const pnlJitter =
    key === "mm"
      ? (Math.random() - 0.5) * 180_000
      : key === "tf"
      ? (Math.random() - 0.45) * 320_000
      : (Math.random() - 0.55) * 420_000

  const winJitter =
    key === "mm"
      ? (Math.random() - 0.5) * 0.25
      : key === "tf"
      ? (Math.random() - 0.5) * 0.35
      : (Math.random() - 0.5) * 0.5

  const ddJitter =
    key === "mm"
      ? (Math.random() - 0.5) * 0.08
      : key === "tf"
      ? (Math.random() - 0.5) * 0.16
      : (Math.random() - 0.5) * 0.22

  const fillJitter =
    key === "mm"
      ? (Math.random() - 0.5) * 0.6
      : key === "tf"
      ? (Math.random() - 0.5) * 0.9
      : (Math.random() - 0.5) * 1.2

  const changeJitter = (Math.random() - 0.5) * 0.35

  // occasional active bots fluctuation (rare)
  let activeBots = s.activeBots
  if (Math.random() < 0.06) {
    activeBots = clamp(
      activeBots + (Math.random() > 0.5 ? 1 : -1),
      Math.max(1, s.totalBots - 2),
      s.totalBots
    )
  }

  const pnlToday = s.pnlToday + pnlJitter
  const winRate = clamp(s.winRate + winJitter, 35, 80)
  const maxDrawdown = clamp(s.maxDrawdown + ddJitter, 0.6, 14)
  const fillRate = clamp(s.fillRate + fillJitter, 45, 99)
  const change24h = clamp(s.change24h + changeJitter, -25, 25)

  // synthetic “health”: weighted
  const health = clamp(
    Math.round(fillRate * 0.45 + winRate * 0.35 + (100 - maxDrawdown * 6) * 0.2),
    0,
    100
  )

  return {
    ...s,
    activeBots,
    pnlToday,
    winRate,
    maxDrawdown,
    fillRate,
    change24h,
    health,
  }
}

function jitterTPM(current: number) {
  // emulate flow: baseline + microbursts
  const baseline = 110 + Math.random() * 60
  const burst = Math.random() < 0.12 ? 30 + Math.random() * 80 : 0
  const next = current * 0.7 + (baseline + burst) * 0.3
  return Math.round(clamp(next, 40, 420))
}

// ----------------------
// UI
// ----------------------
export function SectionCards() {
  const [stats, setStats] = React.useState<UiStats>(() => makeInitial())

  React.useEffect(() => {
    const id = setInterval(() => {
      setStats((prev) => {
        const mm = jitterGroup(prev.mm, "mm")
        const tf = jitterGroup(prev.tf, "tf")
        const nt = jitterGroup(prev.nt, "nt")
        const tpm = jitterTPM(prev.tradesPerMin)

        // change indicators (fake but plausible)
        const tpmChange = clamp(prev.tpmChange + (Math.random() - 0.5) * 0.6, -20, 20)

        return {
          mm,
          tf,
          nt,
          tradesPerMin: tpm,
          tpmChange,
        }
      })
    }, 1200)

    return () => clearInterval(id)
  }, [])

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <PerfCard
        title="Market Maker Bots"
        subtitle={`${stats.mm.activeBots}/${stats.mm.totalBots} active • Fill rate ${formatPct(stats.mm.fillRate)}`}
        main={
          <AnimatedNumber
            value={stats.mm.pnlToday}
            format={(v) => formatVNDCompact(v)}
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
          />
        }
        change={stats.mm.change24h}
        footerLine1={`Health ${stats.mm.health}/100 • Max DD ${formatPct(stats.mm.maxDrawdown)}`}
        footerLine2={`Win rate ${formatPct(stats.mm.winRate)} • Liquidity tightening`}
        health={stats.mm.health}
      />

      <PerfCard
        title="Trend Follower Bots"
        subtitle={`${stats.tf.activeBots}/${stats.tf.totalBots} active • Trend capture`}
        main={
          <AnimatedNumber
            value={stats.tf.pnlToday}
            format={(v) => formatVNDCompact(v)}
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
          />
        }
        change={stats.tf.change24h}
        footerLine1={`Health ${stats.tf.health}/100 • Max DD ${formatPct(stats.tf.maxDrawdown)}`}
        footerLine2={`Win rate ${formatPct(stats.tf.winRate)} • Stops & TP managed`}
        health={stats.tf.health}
      />

      <PerfCard
        title="Noise Trader Bots"
        subtitle={`${stats.nt.activeBots}/${stats.nt.totalBots} active • Volatility injection`}
        main={
          <AnimatedNumber
            value={stats.nt.pnlToday}
            format={(v) => formatVNDCompact(v)}
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
          />
        }
        change={stats.nt.change24h}
        footerLine1={`Health ${stats.nt.health}/100 • Max DD ${formatPct(stats.nt.maxDrawdown)}`}
        footerLine2={`Win rate ${formatPct(stats.nt.winRate)} • Randomized execution`}
        health={stats.nt.health}
      />

      <PerfCard
        title="Trades / Minute"
        subtitle="Bot-to-bot + user fills (rolling 60s)"
        main={
          <AnimatedNumber
            value={stats.tradesPerMin}
            format={(v) => `${Math.round(v).toLocaleString("vi-VN")}`}
            className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"
          />
        }
        change={stats.tpmChange}
        footerLine1={`Throughput stable • Micro-bursts detected`}
        footerLine2={`Order book refresh & stabilizers active`}
        health={clamp(Math.round(stats.tradesPerMin / 4), 0, 100)}
        suffix="tpm"
      />
    </div>
  )
}

function PerfCard({
  title,
  subtitle,
  main,
  change,
  footerLine1,
  footerLine2,
  health,
  suffix,
}: {
  title: string
  subtitle: string
  main: React.ReactNode
  change: number
  footerLine1: string
  footerLine2: string
  health: number
  suffix?: string
}) {
  const isUp = change >= 0

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center justify-between gap-2">
          <span className="truncate">{title}</span>
          {suffix ? (
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              {suffix}
            </span>
          ) : null}
        </CardDescription>

        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {main}
        </CardTitle>

        <CardAction>
          <motion.div
            initial={{ scale: 0.98, opacity: 0.9 }}
            animate={{ scale: [0.98, 1, 0.98], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Badge variant="outline">
              {isUp ? <IconTrendingUp /> : <IconTrendingDown />}
              {isUp ? "+" : ""}
              {formatPct(change)}
            </Badge>
          </motion.div>
        </CardAction>
      </CardHeader>

      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="text-muted-foreground line-clamp-1">{subtitle}</div>

        {/* health bar */}
        <div className="w-full">
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <motion.div
              className="bg-primary h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${clamp(health, 0, 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="line-clamp-1 flex gap-2 font-medium">{footerLine1}</div>
        <div className="text-muted-foreground line-clamp-1">{footerLine2}</div>
      </CardFooter>
    </Card>
  )
}
