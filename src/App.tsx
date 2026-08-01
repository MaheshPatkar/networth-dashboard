import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardData } from './types'
import { fetchDashboard, formatCompactCurrency, formatCurrency, formatDate } from './types'
import './App.css'

const ASSET_COLOR = '#22c55e'
const LIABILITY_COLOR = '#ef4444'
const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ef4444', '#84cc16']
const DEFAULT_GROWTH_RATE = 0.08
const PROJECTION_YEARS = 10

function renderPieLabel({ name, percent }: { name?: string; percent?: number }) {
  const percentage = typeof percent === 'number' ? Math.round(percent * 100) : 0
  return `${name ?? 'Category'}: ${percentage}%`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function getYearsBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0
  }

  return Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365), 0)
}

function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const assetBreakdown = useMemo(
    () => data?.breakdown.filter((item) => item.type === 'asset') ?? [],
    [data],
  )

  const liabilityBreakdown = useMemo(
    () => data?.breakdown.filter((item) => item.type === 'liability') ?? [],
    [data],
  )

  const trendData = useMemo(
    () =>
      (data?.snapshots ?? []).map((snapshot) => ({
        ...snapshot,
        label: formatDate(snapshot.date),
      })),
    [data],
  )

  const averageGrowthRate = useMemo(() => {
    const snapshots = data?.snapshots ?? []

    if (snapshots.length >= 2) {
      const startSnapshot = snapshots[0]
      const endSnapshot = snapshots[snapshots.length - 1]
      const years = getYearsBetween(startSnapshot.date, endSnapshot.date)

      if (years > 0 && startSnapshot.total_assets > 0 && endSnapshot.total_assets > startSnapshot.total_assets) {
        return (endSnapshot.total_assets / startSnapshot.total_assets) ** (1 / years) - 1
      }
    }

    return DEFAULT_GROWTH_RATE
  }, [data])

  const projectedAssets = useMemo(() => {
    const currentAssets = data?.summary.total_assets ?? 0
    return currentAssets * (1 + averageGrowthRate) ** PROJECTION_YEARS
  }, [data, averageGrowthRate])

  const annualGrowthAmount = useMemo(() => {
    const currentAssets = data?.summary.total_assets ?? 0
    return currentAssets * averageGrowthRate
  }, [data, averageGrowthRate])

  const projectedGain = useMemo(() => projectedAssets - (data?.summary.total_assets ?? 0), [projectedAssets, data])

  const sortedAccounts = useMemo(
    () => [...(data?.accounts ?? [])].sort((a, b) => b.value - a.value),
    [data],
  )

  if (loading) {
    return <div className="page"><div className="panel">Loading dashboard...</div></div>
  }

  if (error || !data) {
    return (
      <div className="page">
        <div className="panel error">
          <h1>Unable to load dashboard</h1>
          <p>{error ?? 'No data was loaded from the Excel workbook.'}</p>
          <p className="hint">Make sure the file is available at <code>/data/networth.xlsx</code>.</p>
        </div>
      </div>
    )
  }

  const { summary } = data

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Personal Finance</p>
          <h1>Net Worth Dashboard</h1>
          <p className="subtitle">Excel-backed and running without a backend.</p>
        </div>
        <div className="as-of">As of {formatDate(summary.as_of_date)}</div>
      </header>

      <section className="metrics">
        <article className="metric-card highlight">
          <span>Net Worth</span>
          <strong>{formatCurrency(summary.net_worth)}</strong>
        </article>
        <article className="metric-card">
          <span>Total Assets</span>
          <strong className="positive">{formatCurrency(summary.total_assets)}</strong>
        </article>
        <article className="metric-card">
          <span>Total Liabilities</span>
          <strong className="negative">{formatCurrency(summary.total_liabilities)}</strong>
        </article>
      </section>

      <section className="panel projection-panel">
        <div className="panel-header">
          <h2>Compounding Projection</h2>
          <p>Estimated growth of your current assets using an average annual growth rate.</p>
        </div>
        <div className="projection-grid">
          <div className="projection-card">
            <span>Average annual growth rate</span>
            <strong>{formatPercent(averageGrowthRate)}</strong>
            <p>{data.snapshots.length >= 2 ? 'Derived from your historical snapshots' : 'Using a conservative assumed rate for now'}</p>
          </div>
          <div className="projection-card">
            <span>Annual growth amount</span>
            <strong>{formatCurrency(annualGrowthAmount)}</strong>
            <p>Based on current assets and the average growth rate</p>
          </div>
          <div className="projection-card">
            <span>Projected value in {PROJECTION_YEARS} years</span>
            <strong className="positive">{formatCurrency(projectedAssets)}</strong>
            <p>Estimated gain: {formatCurrency(projectedGain)}</p>
          </div>
        </div>
      </section>

      <section className="grid two-col">
        <article className="panel">
          <div className="panel-header">
            <h2>Net Worth Trend</h2>
            <p>Historical snapshots from your Excel file</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Line type="monotone" dataKey="net_worth" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Assets vs Liabilities</h2>
            <p>Current balance sheet totals</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={[
                  { name: 'Assets', value: summary.total_assets },
                  { name: 'Liabilities', value: summary.total_liabilities },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => formatCompactCurrency(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  <Cell fill={ASSET_COLOR} />
                  <Cell fill={LIABILITY_COLOR} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid two-col">
        <article className="panel">
          <div className="panel-header">
            <h2>Asset Mix</h2>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={assetBreakdown}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={95}
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {assetBreakdown.map((entry, index) => (
                    <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Liability Mix</h2>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={liabilityBreakdown}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={55}
                  outerRadius={95}
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {liabilityBreakdown.map((entry, index) => (
                    <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Accounts</h2>
          <p>All rows from the <code>accounts</code> sheet in Excel</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Value</th>
                <th>As Of</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sortedAccounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>
                    <span className={`badge ${account.type}`}>{account.type}</span>
                  </td>
                  <td>{account.category}</td>
                  <td className={account.type === 'asset' ? 'positive' : 'negative'}>
                    {formatCurrency(account.value)}
                  </td>
                  <td>{formatDate(account.as_of_date)}</td>
                  <td>{account.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default App
