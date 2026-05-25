import React, { useEffect, useMemo, useState } from 'react';
import { api, formatRupiah } from '../services/api.js';
import { onDataChanged } from '../components/Tour.jsx'; // TOUR
import MonthlySalesChart from '../components/MonthlySalesChart.jsx';
import ProductMixChart from '../components/ProductMixChart.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import Skeleton from '../components/Skeleton.jsx';
import {
  ChartBarIcon,
  DownloadIcon,
  TrendUpIcon,
  TrendDownIcon,
} from '../components/Icons.jsx';

// ── Date helpers (operate on local "today" — backend handles WIB conversion) ──

function pad(n) { return String(n).padStart(2, '0'); }
function toIso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function todayIso() { return toIso(new Date()); }

function startOfWeekIso() {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return toIso(d);
}

function startOfMonthIso() {
  const d = new Date();
  return toIso(new Date(d.getFullYear(), d.getMonth(), 1));
}

function lastMonthRange() {
  const d = new Date();
  const firstOfThis = new Date(d.getFullYear(), d.getMonth(), 1);
  const lastOfPrev = new Date(firstOfThis.getTime() - 86400000);
  const firstOfPrev = new Date(lastOfPrev.getFullYear(), lastOfPrev.getMonth(), 1);
  return { from: toIso(firstOfPrev), to: toIso(lastOfPrev) };
}

// "All Time" is async — its `from` is the earliest order's WIB date (fetched once).
// Until known, it falls back to the start of the current month so charts stay sensible.
const PRESETS = [
  { key: 'today', label: 'Today', get: () => ({ from: todayIso(), to: todayIso() }) },
  { key: 'week', label: 'This Week', get: () => ({ from: startOfWeekIso(), to: todayIso() }) },
  { key: 'month', label: 'This Month', get: () => ({ from: startOfMonthIso(), to: todayIso() }) },
  { key: 'last-month', label: 'Last Month', get: () => lastMonthRange() },
  { key: 'all', label: 'All Time', get: (earliest) => ({ from: earliest || startOfMonthIso(), to: todayIso() }) },
];

function detectPreset(from, to, earliest) {
  for (const p of PRESETS) {
    const r = p.get(earliest);
    if (r.from === from && r.to === to) return p.key;
  }
  return 'custom';
}

function readRangeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  const to = params.get('to');
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to };
  }
  return null;
}

function writeRangeToUrl(from, to) {
  const params = new URLSearchParams(window.location.search);
  params.set('from', from);
  params.set('to', to);
  const newUrl = window.location.pathname + '?' + params.toString();
  window.history.replaceState(null, '', newUrl);
}

// Humane range label: "Apr 1 → Apr 30, 2025" for cross-day; "Apr 1, 2025" for single-day.
// Cross-year ranges keep both years explicit. Falls back to the raw ISO if parsing fails.
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const FULL_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function parseIsoLocal(iso) {
  // YYYY-MM-DD → Date in local time (avoid UTC shift)
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function formatRangeLabel(from, to) {
  const fd = parseIsoLocal(from);
  const td = parseIsoLocal(to);
  if (!fd || !td) return from === to ? from : `${from} → ${to}`;
  if (from === to) return FULL_FMT.format(fd);
  const sameYear = fd.getFullYear() === td.getFullYear();
  if (sameYear) return `${MONTH_FMT.format(fd)} → ${FULL_FMT.format(td)}`;
  return `${FULL_FMT.format(fd)} → ${FULL_FMT.format(td)}`;
}

export default function Reports() {
  const initial = readRangeFromUrl() || PRESETS.find((p) => p.key === 'month').get();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [earliestDate, setEarliestDate] = useState(null);
  const [reloadKey, setReloadKey] = useState(0); // TOUR: bumped on data-changed to force refetch
  useEffect(() => onDataChanged(() => setReloadKey((k) => k + 1)), []);

  const activePreset = useMemo(() => detectPreset(from, to, earliestDate), [from, to, earliestDate]);

  // Sync URL
  useEffect(() => {
    if (from && to) writeRangeToUrl(from, to);
  }, [from, to]);

  // Debounced fetch
  useEffect(() => {
    if (!from || !to) return;
    // Auto-swap silently
    if (from > to) {
      setFrom(to);
      setTo(from);
      return;
    }

    const isFirstLoad = report === null;
    if (isFirstLoad) setLoading(true);
    else setRefetching(true);

    const handle = setTimeout(async () => {
      try {
        setError(null);
        const [orders, products, ingredients, sales, expenses] = await Promise.all([
          api.getOrders(from, to),
          api.getProducts(),
          api.getIngredients(),
          api.getMonthlySales(from, to),
          api.getExpenses(from, to),
        ]);
        setSalesData(sales);
        const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

        const ingMap = {};
        ingredients.forEach((ing) => {
          ingMap[ing.id] = { name: ing.name, unit: ing.unit, costPerUnit: Number(ing.costPerUnit || 0) };
        });
        const recipeMap = {};
        products.forEach((p) => {
          recipeMap[p.id] = (p.recipes || []).map((r) => ({
            ingredientId: r.ingredientId,
            quantityRequired: Number(r.quantityRequired),
          }));
        });

        let totalRevenue = 0;
        const productSales = {};
        const ingredientUsage = {};

        orders.forEach((order) => {
          totalRevenue += Number(order.total);
          order.items.forEach((item) => {
            const pid = item.productId;
            const qty = item.quantity;
            const lineRevenue = Number(item.unitPrice) * qty;
            if (!productSales[pid]) {
              productSales[pid] = { name: item.product.name, quantity: 0, revenue: 0, cost: 0 };
            }
            productSales[pid].quantity += qty;
            productSales[pid].revenue += lineRevenue;

            if (item.ingredientCost != null) {
              productSales[pid].cost += Number(item.ingredientCost);
            } else {
              const recipes = recipeMap[pid] || [];
              recipes.forEach((r) => {
                const ing = ingMap[r.ingredientId];
                if (ing) productSales[pid].cost += r.quantityRequired * qty * ing.costPerUnit;
              });
            }

            const recipes = recipeMap[pid] || [];
            recipes.forEach((r) => {
              if (!ingredientUsage[r.ingredientId]) ingredientUsage[r.ingredientId] = 0;
              ingredientUsage[r.ingredientId] += r.quantityRequired * qty;
            });
          });
        });

        let totalCost = 0;
        const ingredientBreakdown = [];
        Object.entries(ingredientUsage).forEach(([ingId, used]) => {
          const ing = ingMap[ingId];
          if (!ing) return;
          const cost = used * ing.costPerUnit;
          totalCost += cost;
          ingredientBreakdown.push({ name: ing.name, unit: ing.unit, used, costPerUnit: ing.costPerUnit, totalCost: cost });
        });
        ingredientBreakdown.sort((a, b) => b.totalCost - a.totalCost);

        // Net profit: revenue minus ingredient cost minus operating expenses (overhead).
        // Per-product profit in the donut stays gross (rev − ingredients) since overhead
        // doesn't allocate per-product — see ProductMixChart.
        const profit = totalRevenue - totalCost - totalExpenses;
        const totalInvestment = totalCost + totalExpenses;
        const roi = totalInvestment > 0 ? (profit / totalInvestment) * 100 : 0;

        const productList = Object.values(productSales).map((p) => ({
          ...p,
          profit: p.revenue - p.cost,
          margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0,
          share: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0,
        })).sort((a, b) => b.revenue - a.revenue);

        setReport({
          orderCount: orders.length,
          totalRevenue,
          totalCost,
          totalExpenses, // operating-expense sum in range; surfaced as a read-only KPI
          profit,
          roi,
          productSales: productList,
          ingredientBreakdown,
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
        setRefetching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, reloadKey]);

  async function applyPreset(key) {
    const p = PRESETS.find((p) => p.key === key);
    if (!p) return;

    // "All Time" needs the earliest order date — fetch on first use, then cache.
    if (key === 'all') {
      let earliest = earliestDate;
      if (!earliest) {
        try {
          const res = await api.getEarliestOrder();
          earliest = res?.date || todayIso();
          setEarliestDate(earliest);
        } catch {
          earliest = todayIso();
        }
      }
      setFrom(earliest);
      setTo(todayIso());
      return;
    }

    const r = p.get(earliestDate);
    setFrom(r.from);
    setTo(r.to);
  }

  function handleExport() {
    if (!from || !to) return;
    api.exportReport(from, to);
  }

  const isEmpty = !loading && report && report.orderCount === 0;
  const inputCls = "border border-divider rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent bg-card";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-ink flex items-center gap-3">
          <ChartBarIcon className="w-7 h-7 text-accent" />
          Reports
          {report && (
            <span className="font-mono text-xs text-ink-tertiary uppercase ml-2">
              {formatRangeLabel(from, to)}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={loading || refetching}
          aria-label="Export report as Excel file"
          className="btn-press bg-cta hover:bg-cta-hover disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
        >
          <DownloadIcon className="w-4 h-4" />
          Export .xlsx
        </button>
      </div>

      {/* Date range control */}
      <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`btn-press rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activePreset === p.key
                    ? 'bg-accent text-white border border-accent'
                    : 'border border-divider text-ink-secondary hover:bg-elevated'
                }`}
              >
                {p.label}
              </button>
            ))}
            {activePreset === 'custom' && (
              <span className="ml-1 font-mono text-[10px] uppercase tracking-wider bg-accent-soft text-accent px-2 py-1 rounded">
                Custom
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0" />
          <div className="flex items-center gap-2">
            <label className="font-mono text-xs text-ink-tertiary uppercase">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
            <label className="font-mono text-xs text-ink-tertiary uppercase">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4 text-sm">{error}</div>
      )}

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-5">
              <Skeleton width="4rem" height="0.75rem" className="mb-3" />
              <Skeleton width="7rem" height="1.75rem" />
            </div>
          ))}
        </div>
      )}

      {!loading && report && (
        <div className="space-y-6">
          {/* Summary cards — KPI cards have per-card skeletons during refetch, so the cards
              themselves stay at full opacity (the values swap to skeletons individually).
              Operating expenses is read-only — surfaces the documentation total without
              recomputing Profit/ROI (per the journal-only design). */}
          <div data-tour="reports-summary" className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard label="Revenue">
              {refetching ? <Skeleton width="6rem" height="1.5rem" /> : (
                <span className="text-ink"><AnimatedNumber value={report.totalRevenue} formatter={formatRupiah} /></span>
              )}
            </SummaryCard>
            <SummaryCard label="Ingredient cost">
              {refetching ? <Skeleton width="6rem" height="1.5rem" /> : (
                <span className="text-ink"><AnimatedNumber value={report.totalCost} formatter={formatRupiah} /></span>
              )}
            </SummaryCard>
            <SummaryCard label="Operating expenses">
              {refetching ? <Skeleton width="6rem" height="1.5rem" /> : (
                <span className="text-ink"><AnimatedNumber value={report.totalExpenses} formatter={formatRupiah} /></span>
              )}
            </SummaryCard>
            <SummaryCard label="Profit">
              {refetching ? <Skeleton width="6rem" height="1.5rem" /> : (
                <span className={`inline-flex items-center gap-1.5 ${report.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {report.profit >= 0
                    ? <TrendUpIcon className="w-4 h-4" aria-label="Positive profit" />
                    : <TrendDownIcon className="w-4 h-4" aria-label="Negative profit" />}
                  <AnimatedNumber value={report.profit} formatter={formatRupiah} />
                </span>
              )}
            </SummaryCard>
            <SummaryCard label="ROI">
              {refetching ? <Skeleton width="4rem" height="1.5rem" /> : (() => {
                const hasInvestment = (report.totalCost + report.totalExpenses) > 0;
                return (
                  <span className={`inline-flex items-center gap-1.5 ${report.roi >= 0 ? 'text-success' : 'text-danger'}`}>
                    {hasInvestment && (report.roi >= 0
                      ? <TrendUpIcon className="w-4 h-4" aria-label="Positive ROI" />
                      : <TrendDownIcon className="w-4 h-4" aria-label="Negative ROI" />)}
                    {hasInvestment ? `${report.roi.toFixed(1)}%` : '—'}
                  </span>
                );
              })()}
            </SummaryCard>
          </div>

          {/* Charts dim during refetch; KPI cards above stay readable via their own
              per-card skeletons (less jarring than a full-page fade). */}
          <div className={`space-y-6 transition-opacity duration-150 ${refetching ? 'opacity-50' : 'opacity-100'}`}>
          {/* Sales chart */}
          <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
            <div className="font-mono text-xs text-ink-tertiary uppercase mb-4 flex items-center gap-2">
              <span>Sales over time</span>
              {salesData?.granularity && (
                <span className="text-[10px] tracking-wider bg-elevated px-1.5 py-0.5 rounded">
                  {salesData.granularity === 'weekly' ? 'weekly' : 'daily'}
                </span>
              )}
            </div>
            {salesData ? (
              <MonthlySalesChart
                points={salesData.points}
                summary={salesData.summary}
                granularity={salesData.granularity}
                formatRupiah={formatRupiah}
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-ink-tertiary text-sm">
                Memuat data...
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product mix */}
            <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
              <div className="font-mono text-xs text-ink-tertiary uppercase mb-4">Product mix</div>
              {isEmpty ? (
                <EmptyMessage />
              ) : (
                <ProductMixChart
                  products={report.productSales}
                  totalRevenue={report.totalRevenue}
                  orderCount={report.orderCount}
                  formatRupiah={formatRupiah}
                />
              )}
            </section>

            {/* Ingredient costs */}
            <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6 flex flex-col">
              <div className="font-mono text-xs text-ink-tertiary uppercase mb-4">Ingredient costs</div>
              {report.ingredientBreakdown.length === 0 ? (
                <EmptyMessage />
              ) : (
                <div className="grid grid-cols-[1fr_auto_auto_auto_6rem] gap-x-3 gap-y-3 items-center">
                  {report.ingredientBreakdown.map((ing) => (
                    <React.Fragment key={ing.name}>
                      <span className="text-sm font-medium text-ink">{ing.name}</span>
                      <span className="text-xs text-ink-tertiary tabular">{ing.used} {ing.unit}</span>
                      <span className="text-xs text-ink-tertiary">@</span>
                      <span className="text-xs text-ink-tertiary tabular">{formatRupiah(ing.costPerUnit)}/{ing.unit}</span>
                      <span className="text-sm text-ink tabular text-right">{formatRupiah(ing.totalCost)}</span>
                    </React.Fragment>
                  ))}
                  <div className="col-span-5 border-t border-divider" />
                  <span className="text-sm font-medium text-ink">Total cost</span>
                  <span /><span /><span />
                  <span className="text-sm font-semibold text-ink tabular text-right">{formatRupiah(report.totalCost)}</span>
                </div>
              )}
            </section>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, children }) {
  return (
    <div className="card-gradient border border-divider/60 rounded-2xl shadow-ambient card-interactive p-5">
      <div className="font-mono text-xs text-ink-tertiary uppercase mb-1">{label}</div>
      <div className="text-2xl font-heading tabular">{children}</div>
    </div>
  );
}

function EmptyMessage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[180px] py-6">
      <ChartBarIcon className="w-10 h-10 mb-2 text-ink-tertiary/40" strokeWidth={1.25} />
      <p className="text-ink-tertiary text-sm">Tidak ada pesanan dalam rentang ini</p>
    </div>
  );
}
