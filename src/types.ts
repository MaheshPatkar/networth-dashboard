import { read, utils } from 'xlsx'

export type AccountType = 'asset' | 'liability'

export interface Account {
  id: number
  name: string
  type: AccountType
  category: string
  value: number
  as_of_date: string
  notes: string
}

export interface Snapshot {
  date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
}

export interface NetWorthSummary {
  total_assets: number
  total_liabilities: number
  net_worth: number
  as_of_date: string | null
}

export interface CategoryBreakdown {
  category: string
  type: AccountType
  total: number
}

export interface DashboardData {
  summary: NetWorthSummary
  accounts: Account[]
  snapshots: Snapshot[]
  breakdown: CategoryBreakdown[]
}

function normalizeDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }

  return String(value)
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function buildBreakdown(accounts: Account[]): CategoryBreakdown[] {
  const groups = new Map<string, { type: AccountType; total: number }>()

  accounts.forEach((account) => {
    const key = `${account.type}:${account.category}`
    const current = groups.get(key)

    if (current) {
      current.total += account.value
    } else {
      groups.set(key, { type: account.type, total: account.value })
    }
  })

  return Array.from(groups.entries())
    .map(([key, value]) => {
      const [type, category] = key.split(':') as [AccountType, string]
      return {
        category,
        type,
        total: value.total,
      }
    })
    .sort((a, b) => b.total - a.total)
}

function buildDashboardData(workbook: ReturnType<typeof read>): DashboardData {
  const accountsSheet = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.accounts, { defval: '' })
  const snapshotsSheet = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.snapshots, { defval: '' })

  const accounts: Account[] = accountsSheet.map((row, index) => {
    const rawValue = row.value ?? row['value (Lakh)'] ?? row['Value'] ?? row['Value (Lakh)'] ?? row['value_lakh'] ?? row['valueInLakh']

    return {
      id: Number(row.id ?? index + 1),
      name: String(row.name ?? ''),
      type: row.type === 'liability' ? 'liability' : 'asset',
      category: String(row.category ?? ''),
      value: toNumber(rawValue),
      as_of_date: normalizeDate(row.as_of_date),
      notes: String(row.notes ?? ''),
    }
  })

  const snapshots: Snapshot[] = snapshotsSheet.map((row) => ({
    date: normalizeDate(row.date),
    total_assets: toNumber(row.total_assets),
    total_liabilities: toNumber(row.total_liabilities),
    net_worth: toNumber(row.net_worth),
  }))

  const summaryFromSnapshots = snapshots[snapshots.length - 1]
  const totalAssets = accounts.filter((account) => account.type === 'asset').reduce((sum, account) => sum + account.value, 0)
  const totalLiabilities = accounts.filter((account) => account.type === 'liability').reduce((sum, account) => sum + account.value, 0)

  const summary: NetWorthSummary = summaryFromSnapshots
    ? {
        total_assets: summaryFromSnapshots.total_assets,
        total_liabilities: summaryFromSnapshots.total_liabilities,
        net_worth: summaryFromSnapshots.net_worth,
        as_of_date: summaryFromSnapshots.date || null,
      }
    : {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: totalAssets - totalLiabilities,
        as_of_date: accounts[0]?.as_of_date ?? null,
      }

  return {
    summary,
    accounts,
    snapshots,
    breakdown: buildBreakdown(accounts),
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(1)} Cr`
  }
  if (abs >= 100_000) {
    return `₹${(value / 100_000).toFixed(1)} L`
  }
  if (abs >= 1_000) {
    return `₹${Math.round(value / 1_000)} K`
  }
  return formatCurrency(value)
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/networth.xlsx`)
  if (!response.ok) {
    throw new Error('Failed to load dashboard data from the Excel workbook')
  }

  const arrayBuffer = await response.arrayBuffer()
  const workbook = read(arrayBuffer, { type: 'array' })
  return buildDashboardData(workbook)
}
