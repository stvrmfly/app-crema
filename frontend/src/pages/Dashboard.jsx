import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api.js';
import Modal from '../components/Modal.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { labelCls } from '../styles.js';
import { formatRupiah } from '../services/api.js';
import {
  SquaresIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
  CheckIcon,
  TrendUpIcon,
  TrendDownIcon,
} from '../components/Icons.jsx';
import { TOUR_ENABLED, TOUR_DISMISSED_KEY, startTour, onDataChanged, onTourEnd, resumeStepFor } from '../components/Tour.jsx'; // TOUR

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStr() {
  return ymd(new Date());
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymd(d);
}
function mondayStr() {
  const d = new Date();
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  return ymd(d);
}
function periodRange(period) {
  if (period === 'today') return [todayStr(), todayStr()];
  if (period === 'week') return [mondayStr(), todayStr()];
  return [null, null];
}
// Prior period for delta comparison. Returns null when no meaningful prior exists.
// 'today' → yesterday. 'week' and 'all' show no delta (keeps the UI honest about
// uneven windows; see DECISIONS.md).
function priorRange(period) {
  if (period === 'today') return { from: yesterdayStr(), to: yesterdayStr() };
  return null;
}

// Sum line-item quantities across an array of orders. Item quantities are integers.
function countItems(orders) {
  if (!orders) return 0;
  return orders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0),
    0
  );
}
// Sum order totals. Backend stores Decimal as string; coerce at the boundary.
function sumRevenue(orders) {
  if (!orders) return 0;
  return orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
}

export default function Dashboard() {
  const [orderCount, setOrderCount] = useState(null);
  const [periodOrders, setPeriodOrders] = useState(null);   // full order objects, for KPI math
  const [priorOrderCount, setPriorOrderCount] = useState(null); // for delta vs yesterday
  const [period, setPeriod] = useState('today');
  const [productCount, setProductCount] = useState(null);
  const [ingredientCount, setIngredientCount] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // TOUR: invitation state (the Tour itself is mounted in App.jsx)
  const [tourDismissed, setTourDismissed] = useState(
    () => !!localStorage.getItem(TOUR_DISMISSED_KEY)
  );

  // Restock modal
  const [restockItem, setRestockItem] = useState(null);
  const [restockValue, setRestockValue] = useState('');
  const [restockError, setRestockError] = useState(null);
  const [restocking, setRestocking] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [from, to] = periodRange(period);
      const prior = priorRange(period);
      const [allOrders, periodList, priorList, ingredients, products] = await Promise.all([
        api.getOrders(),
        from && to ? api.getOrders(from, to) : Promise.resolve(null),
        prior ? api.getOrders(prior.from, prior.to) : Promise.resolve(null),
        api.getIngredients(),
        api.getProducts(),
      ]);
      setOrderCount(allOrders.length);
      setPeriodOrders(periodList ?? allOrders);
      setPriorOrderCount(priorList ? priorList.length : null);
      setProductCount(products.length);
      setIngredientCount(ingredients.length);
      setLowStock(
        ingredients.filter((ing) => Number(ing.stockQuantity) < Number(ing.lowStockThreshold))
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [period]);
  useEffect(() => onDataChanged(load), []); // TOUR: reflect tour-created data
  useEffect(() => onTourEnd(load), []);      // TOUR: refresh when user exits mid-tour

  function openRestock(ing) {
    setRestockItem(ing);
    setRestockValue(String(Number(ing.stockQuantity)));
    setRestockError(null);
  }

  async function submitRestock(e) {
    e.preventDefault();
    setRestockError(null);
    setRestocking(true);
    try {
      await api.updateIngredient(restockItem.id, { stockQuantity: Number(restockValue) });
      setRestockItem(null);
      load();
    } catch (e) { setRestockError(e.message); }
    finally { setRestocking(false); }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-heading text-ink flex items-center gap-3">
        <SquaresIcon className="w-7 h-7 text-accent" />
        Dashboard
      </h1>

      {error && (
        <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Onboarding placement. Three states, data-derived:
          · fullyEmpty  → WelcomeHero takes over the hero card (preserves data-tour anchor)
          · partial     → SetupBanner sits above the regular pulse hero, single row
          · done        → just the pulse hero, no onboarding chrome */}
      {(() => {
        const fullyEmpty = !loading && ingredientCount === 0 && productCount === 0 && orderCount === 0;
        const partial = !loading && !fullyEmpty &&
          (ingredientCount === 0 || productCount === 0 || orderCount === 0);

        if (fullyEmpty) {
          return (
            <WelcomeHero
              ingredientCount={ingredientCount}
              productCount={productCount}
              orderCount={orderCount}
              tourDismissed={tourDismissed}
              onStartTour={() => {
                localStorage.setItem(TOUR_DISMISSED_KEY, '1');
                setTourDismissed(true);
                startTour();
              }}
              onDismissTour={() => {
                localStorage.setItem(TOUR_DISMISSED_KEY, '1');
                setTourDismissed(true);
              }}
            />
          );
        }

        return (
          <>
            {partial && (
              <SetupBanner
                ingredientCount={ingredientCount}
                productCount={productCount}
                orderCount={orderCount}
              />
            )}
            <PulseHero
              loading={loading}
              periodOrders={periodOrders}
              priorOrderCount={priorOrderCount}
              period={period}
              onPeriodChange={setPeriod}
            />
          </>
        );
      })()}

      {/* Secondary KPI row: revenue, AOV, items sold — computed from periodOrders. */}
      <SecondaryKpis loading={loading} orders={periodOrders} period={period} />

      {/* Needs attention: full-width panel for low-stock ingredients. Demoted visual weight
          when empty; only emphasized when there's something to act on. */}
      <NeedsAttention
        loading={loading}
        lowStock={lowStock}
        orderCount={orderCount}
        error={error}
        onRestock={openRestock}
      />

      <DevPanel onChange={load} setError={setError} onReset={() => { localStorage.removeItem(TOUR_DISMISSED_KEY); setTourDismissed(false); }} />

      <Modal
        open={!!restockItem}
        onClose={() => setRestockItem(null)}
        title={restockItem ? `Restock ${restockItem.name}` : ''}
      >
        {restockItem && (
          <form onSubmit={submitRestock} className="space-y-4">
            {restockError && (
              <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 text-sm">
                {restockError}
              </div>
            )}
            <div className="flex items-center gap-3 bg-accent-soft border border-accent/15 rounded-xl p-3">
              <AlertTriangleIcon className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="text-sm text-accent">
                Current stock: <span className="font-medium tabular">{Number(restockItem.stockQuantity)} {restockItem.unit}</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>
                New stock quantity ({restockItem.unit})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={restockValue}
                onChange={(e) => setRestockValue(e.target.value)}
                className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              disabled={restocking}
              className="btn-press w-full bg-success hover:bg-success-hover disabled:bg-divider text-white rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              {restocking ? 'Updating...' : 'Update stock'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ── Hero states ──
// Three mutually-exclusive renderings of the top hero region, driven by onboarding state.

// PulseHero: the standard hero. Big orders count + period toggle + (optional) delta line.
// Used for `partial` and `done` states. Keeps the data-tour="dashboard-pulse" anchor.
function PulseHero({ loading, periodOrders, priorOrderCount, period, onPeriodChange }) {
  return (
    <section
      data-tour="dashboard-pulse"
      className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-8"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">
          {period === 'today' ? 'Orders today' : period === 'week' ? 'Orders this week' : 'All-time orders'}
        </div>
        <PeriodToggle value={period} onChange={onPeriodChange} />
      </div>
      <div
        className="font-heading text-accent tabular leading-none"
        style={{ fontSize: 'clamp(3.5rem, 10vw, 6.5rem)' }}
        aria-live="polite"
      >
        {loading ? (
          <Skeleton width="8rem" height="5rem" />
        ) : (
          <AnimatedNumber value={periodOrders ? periodOrders.length : 0} />
        )}
      </div>
      {!loading && priorOrderCount !== null && periodOrders && (
        <DeltaLine
          current={periodOrders.length}
          prior={priorOrderCount}
          currentLabel="today"
          priorLabel="yesterday"
        />
      )}
    </section>
  );
}

// WelcomeHero: the hero card itself becomes onboarding when the app is fully empty.
// Holds the three-row checklist and a dev-only "Take the tour" footer. Production users
// see only the checklist + welcome copy; tour offer is gated by TOUR_ENABLED + dismiss.
function WelcomeHero({ ingredientCount, productCount, orderCount, tourDismissed, onStartTour, onDismissTour }) {
  const showTourCTA = TOUR_ENABLED && !tourDismissed;
  const counts = { ingredients: ingredientCount, products: productCount, orders: orderCount };
  return (
    <section
      data-tour="dashboard-pulse"
      className="animate-fade-in card-gradient border border-accent/25 rounded-2xl shadow-ambient p-8"
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-2">Welcome</p>
      <h2 className="font-heading text-3xl text-ink leading-tight mb-2">Get your shop ready</h2>
      <p className="text-sm text-ink-secondary mb-6 max-w-md">
        Three steps to your first sale. Each one updates what's tracked on this dashboard.
      </p>

      <ol className="space-y-1 mb-2">
        <ChecklistRow
          n={1}
          done={ingredientCount > 0}
          count={ingredientCount}
          unit="added"
          label="Add ingredients"
          sublabel="The raw materials your recipes draw from"
          to="/app/inventory"
          onResume={TOUR_ENABLED ? () => startTour(resumeStepFor('ingredients', counts)) : null}
        />
        <ChecklistRow
          n={2}
          done={productCount > 0}
          count={productCount}
          unit="created"
          label="Create products with recipes"
          sublabel="Each product's recipe links sales to inventory"
          to="/app/products"
          onResume={TOUR_ENABLED ? () => startTour(resumeStepFor('product', counts)) : null}
        />
        <ChecklistRow
          n={3}
          done={orderCount > 0}
          count={orderCount}
          unit="placed"
          label="Take your first order"
          sublabel="Stock will deduct automatically when you submit"
          to="/app/orders"
          onResume={TOUR_ENABLED ? () => startTour(resumeStepFor('order', counts)) : null}
        />
      </ol>

      {showTourCTA && (
        <div className="mt-6 pt-5 border-t border-divider/60 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink-secondary">Prefer a guided demo?</p>
            <p className="text-xs text-ink-tertiary">About 90 seconds with realistic data prefilled.</p>
          </div>
          <button
            type="button"
            onClick={onDismissTour}
            className="btn-press border border-divider text-ink-secondary hover:bg-elevated rounded-lg px-3 py-1.5 text-sm"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onStartTour}
            className="btn-press bg-accent hover:bg-accent-hover text-white rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            Start tour
          </button>
        </div>
      )}
    </section>
  );
}

// SetupBanner: slim one-row chip during mid-setup. Shows N of 3 done + the next-step
// link. Disappears entirely once all three categories have data, and is replaced by the
// WelcomeHero when fully empty. Sits above PulseHero so it never pushes the main pulse
// out of view by more than ~50px.
function SetupBanner({ ingredientCount, productCount, orderCount }) {
  const done =
    (ingredientCount > 0 ? 1 : 0) +
    (productCount > 0 ? 1 : 0) +
    (orderCount > 0 ? 1 : 0);
  const next =
    ingredientCount === 0
      ? { label: 'Add ingredients', to: '/app/inventory' }
      : productCount === 0
        ? { label: 'Create a product with a recipe', to: '/app/products' }
        : { label: 'Take your first order', to: '/app/orders' };
  return (
    <Link
      to={next.to}
      className="animate-fade-in row-hover group flex items-center justify-between gap-3 card-gradient border border-accent/25 rounded-xl shadow-ambient px-4 py-3"
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent flex-shrink-0">
          Setup · <span className="tabular">{done}</span>/3
        </span>
        <span className="text-sm text-ink truncate">{next.label}</span>
      </span>
      <ChevronRightIcon className="w-4 h-4 text-ink-tertiary group-hover:text-ink-secondary group-hover:translate-x-0.5 transition-[transform,color] flex-shrink-0" />
    </Link>
  );
}

// ── Delta line ──
// Renders "↑ N more than yesterday" / "↓ N fewer than yesterday" / "Same as yesterday" /
// "No orders yesterday" with an icon + token-backed color. Only mounted when a prior
// comparison window is meaningful (e.g. today vs yesterday).

function DeltaLine({ current, prior, currentLabel, priorLabel }) {
  if (prior === 0 && current === 0) {
    return (
      <div className="mt-3 text-sm text-ink-tertiary">
        No orders {priorLabel} either — quiet stretch.
      </div>
    );
  }
  if (prior === 0) {
    return (
      <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-success">
        <TrendUpIcon className="w-4 h-4" />
        <span><span className="font-medium tabular">{current}</span> {currentLabel}, none {priorLabel}</span>
      </div>
    );
  }
  const diff = current - prior;
  if (diff === 0) {
    return (
      <div className="mt-3 text-sm text-ink-tertiary">
        Same as {priorLabel} (<span className="tabular">{prior}</span>).
      </div>
    );
  }
  const isUp = diff > 0;
  const Icon = isUp ? TrendUpIcon : TrendDownIcon;
  const tone = isUp ? 'text-success' : 'text-danger';
  return (
    <div className={`mt-3 inline-flex items-center gap-1.5 text-sm ${tone}`}>
      <Icon className="w-4 h-4" />
      <span>
        <span className="font-medium tabular">{Math.abs(diff)}</span> {isUp ? 'more' : 'fewer'} than {priorLabel}
        <span className="text-ink-tertiary"> · <span className="tabular">{prior}</span> {priorLabel}</span>
      </span>
    </div>
  );
}

// ── Secondary KPI row ──
// Revenue / Average order value / Items sold, computed from the active periodOrders list.
// Shows skeletons while loading; em-dashes when there's no data to divide by.

function SecondaryKpis({ loading, orders, period }) {
  const count = orders ? orders.length : 0;
  const revenue = sumRevenue(orders);
  const items = countItems(orders);
  const aov = count > 0 ? revenue / count : 0;

  const periodSuffix = period === 'today' ? 'today' : period === 'week' ? 'this week' : 'all-time';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard label={`Revenue ${periodSuffix}`} loading={loading}>
        {count === 0 ? '—' : <AnimatedNumber value={revenue} formatter={formatRupiah} />}
      </KpiCard>
      <KpiCard label="Avg order value" loading={loading}>
        {count === 0 ? '—' : <AnimatedNumber value={Math.round(aov)} formatter={formatRupiah} />}
      </KpiCard>
      <KpiCard label={`Items sold ${periodSuffix}`} loading={loading}>
        {count === 0 ? '—' : <AnimatedNumber value={items} />}
      </KpiCard>
    </div>
  );
}

function KpiCard({ label, loading, children }) {
  return (
    <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-5">
      <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-heading text-ink tabular">
        {loading ? <Skeleton width="6rem" height="1.75rem" /> : children}
      </div>
    </section>
  );
}

// ── Needs attention ──
// Full-width panel. Demoted to a quiet "all good" message when nothing is low.
// Each low-stock entry is a real <button> so it's keyboard-accessible.

function NeedsAttention({ loading, lowStock, orderCount, error, onRestock }) {
  return (
    <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">
          Needs attention
        </div>
        {!loading && lowStock.length > 0 && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase bg-danger-soft text-danger px-2 py-0.5 rounded">
            <AlertTriangleIcon className="w-3 h-3" />
            {lowStock.length} low
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton width="100%" height="2.75rem" />
          <Skeleton width="85%" height="2.75rem" />
        </div>
      ) : lowStock.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-ink-tertiary">
          <CheckIcon className="w-4 h-4 text-success" />
          {orderCount === 0 && !error
            ? 'No ingredients added yet'
            : 'All ingredients above threshold'}
        </div>
      ) : (
        <ul className="space-y-2">
          {lowStock.map((ing) => (
            <li key={ing.id}>
              <button
                type="button"
                onClick={() => onRestock(ing)}
                aria-label={`Restock ${ing.name}, currently ${Number(ing.stockQuantity)} ${ing.unit}, below threshold ${Number(ing.lowStockThreshold)}`}
                className="row-hover w-full flex justify-between items-center text-sm border border-danger/30 bg-danger-soft/30 text-ink rounded-lg px-4 py-3 text-left transition-colors hover:bg-danger-soft/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangleIcon className="w-4 h-4 text-danger flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="font-medium">{ing.name}</span>
                    <span className="text-ink-tertiary text-xs ml-1.5">(min {Number(ing.lowStockThreshold)})</span>
                  </span>
                </div>
                <span className="tabular flex items-center gap-2 flex-shrink-0">
                  {Number(ing.stockQuantity)} {ing.unit}
                  <ChevronRightIcon className="w-3.5 h-3.5 text-ink-tertiary" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Period toggle for the Orders pulse card ──

function PeriodToggle({ value, onChange }) {
  const opts = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'all', label: 'All' },
  ];
  return (
    <div
      role="group"
      aria-label="Period filter"
      className="inline-flex bg-elevated/60 rounded-lg p-0.5 border border-divider/60"
    >
      {opts.map((o) => {
        const isActive = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={isActive}
            className={`btn-press px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider rounded-md transition-colors ${
              isActive ? 'bg-card text-ink shadow-sm' : 'text-ink-tertiary hover:text-ink-secondary'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Getting Started checklist row ──

function ChecklistRow({ n, done, count, unit, label, sublabel, to, onResume }) {
  // In dev when this row is incomplete, click resumes the tour at the right step
  // (skipping navigation). In prod, or for completed rows, fall back to a regular Link.
  const useResume = !!onResume && !done;

  const inner = (
    <>
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono transition-colors ${
          done ? 'bg-success text-white' : 'bg-elevated border border-divider text-ink-tertiary'
        }`}
      >
        {done ? (
          <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
        ) : (
          n
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block text-sm ${done ? 'text-ink-tertiary line-through' : 'text-ink'}`}>
          {label}
        </span>
        {!done && (
          <span className="block text-xs text-ink-tertiary truncate">{sublabel}</span>
        )}
      </span>
      <span className="font-mono text-[10px] text-ink-tertiary uppercase tracking-wider">
        {count} {unit}
      </span>
      {!done && (
        <ChevronRightIcon className="w-3.5 h-3.5 text-ink-tertiary group-hover:translate-x-0.5 group-hover:text-ink-secondary transition-[transform,color]" />
      )}
    </>
  );

  const cls = 'group flex items-center gap-3 rounded-lg px-3 py-2.5 row-hover transition-colors w-full text-left';

  return (
    <li>
      {useResume ? (
        <button type="button" onClick={onResume} className={cls}>{inner}</button>
      ) : (
        <Link to={to} className={cls}>{inner}</Link>
      )}
    </li>
  );
}

// ── Dev Panel (breaker-panel style) ──

function DevPanel({ onChange, setError, onReset }) {
  const [busyKey, setBusyKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [fillMonthOpen, setFillMonthOpen] = useState(false);

  function nowMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const [fillMonth, setFillMonth] = useState(nowMonthStr());
  const [fillBusy, setFillBusy] = useState(false);
  const [fillLog, setFillLog] = useState([]); // newest first

  async function run(key, fn, { confirm = false } = {}) {
    if (confirm && confirmKey !== key) {
      setConfirmKey(key);
      return;
    }
    setBusyKey(key);
    setConfirmKey(null);
    setFeedback(null);
    try {
      const res = await fn();
      setFeedback({ kind: 'ok', text: res?.message || 'Done' });
      onChange?.();
    } catch (e) {
      setFeedback({ kind: 'err', text: e.message });
      setError?.(e.message);
    } finally {
      setBusyKey(null);
    }
  }

  async function submitFillMonth() {
    if (!/^\d{4}-\d{2}$/.test(fillMonth)) {
      setFillLog((prev) => [{ kind: 'err', month: fillMonth, text: 'Invalid month. Use YYYY-MM.' }, ...prev]);
      return;
    }
    setFillBusy(true);
    try {
      const res = await api.fillData(fillMonth);
      setFillLog((prev) => [
        { kind: 'ok', month: fillMonth, text: res?.message || 'Done' },
        ...prev,
      ]);
      // Auto-advance to next month so consecutive backfills are one click apart
      const [y, m] = fillMonth.split('-').map(Number);
      const next = new Date(y, m, 1); // m is 0-indexed for next month
      setFillMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
      onChange?.();
    } catch (e) {
      setFillLog((prev) => [{ kind: 'err', month: fillMonth, text: e.message }, ...prev]);
      setError?.(e.message);
    } finally {
      setFillBusy(false);
    }
  }

  const buttons = [
    { key: 'reset', label: 'Reset', danger: true, confirm: true, action: async () => { const r = await api.resetAll(); onReset?.(); return r; } },
    { key: 'seed-basic', label: 'Seed Basic', confirm: true, action: () => api.seedBasic() },
    { key: 'seed-full', label: 'Seed Full', confirm: true, action: () => api.seedFull() },
    { key: 'fill-data', label: 'Fill Data', action: () => { setFillMonthOpen(true); setConfirmKey(null); setFeedback(null); }, isCustom: true },
    { key: 'drain-stock', label: 'Drain Stock', action: () => api.drainStock() },
    { key: 'refill-stock', label: 'Refill Stock', action: () => api.refillStock() },
  ];

  return (
    <details className="group">
      <summary className="flex items-center gap-2 cursor-pointer text-ink-tertiary hover:text-ink-secondary transition-colors select-none list-none">
        <ChevronRightIcon className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
        <span className="font-mono text-xs uppercase">Dev panel</span>
      </summary>

      <div className="mt-3 ml-5">
        <div
          className="w-60 rounded-xl border border-divider bg-elevated/60 p-3 shadow-inner"
          style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="font-mono text-[10px] tracking-wider text-ink-tertiary uppercase">Dev Panel</span>
            <span className="font-mono text-[10px] text-ink-tertiary uppercase">v1</span>
          </div>

          <div className="space-y-2">
            {buttons.map((b) => {
              const isConfirming = confirmKey === b.key;
              const isBusy = busyKey === b.key;
              const baseCls = 'btn-press w-full h-9 rounded-md font-mono text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center';

              if (isConfirming) {
                return (
                  <div key={b.key} className="flex gap-1.5">
                    <button
                      onClick={() => run(b.key, b.action, { confirm: false })}
                      disabled={isBusy}
                      className={`${baseCls} flex-1 ${b.danger ? 'bg-danger text-white hover:bg-danger-hover' : 'bg-accent text-white hover:bg-accent-hover'}`}
                    >
                      {isBusy ? '...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmKey(null)}
                      className={`${baseCls} flex-1 border border-divider text-ink-tertiary hover:bg-elevated`}
                    >
                      Cancel
                    </button>
                  </div>
                );
              }

              return (
                <button
                  key={b.key}
                  onClick={() => {
                    if (b.isCustom) b.action();
                    else run(b.key, b.action, { confirm: b.confirm });
                  }}
                  disabled={isBusy}
                  className={`${baseCls} border ${
                    b.danger
                      ? 'border-danger/30 text-danger hover:bg-danger-soft'
                      : 'border-divider text-ink-secondary hover:bg-card hover:text-ink hover:border-ink-tertiary/40'
                  }`}
                  title={b.label}
                >
                  {isBusy ? '...' : b.label}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div
              className={`mt-3 px-2 py-1.5 rounded text-[10px] font-mono leading-tight ${
                feedback.kind === 'ok'
                  ? 'bg-success-soft text-success'
                  : 'bg-danger-soft text-danger'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={fillMonthOpen}
        onClose={() => { if (!fillBusy) { setFillMonthOpen(false); setFillLog([]); } }}
        title="Fill Data: choose month"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); submitFillMonth(); }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>
              Month (YYYY-MM)
            </label>
            <input
              type="month"
              value={fillMonth}
              onChange={(e) => setFillMonth(e.target.value)}
              className="w-full border border-divider rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              autoFocus
              required
            />
          </div>
          <p className="text-xs text-ink-tertiary leading-relaxed">
            Generates 3–12 random orders per day plus a realistic batch of operating
            expenses (small-business scale, with some inconsistencies baked in). Past
            months fill completely; the current month only fills up to today. Modal stays
            open so you can backfill several months in a row.
          </p>

          {fillLog.length > 0 && (
            <div className="border border-divider rounded-lg max-h-40 overflow-y-auto divide-y divide-divider/60">
              {fillLog.map((entry, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 text-xs font-mono leading-snug ${
                    entry.kind === 'ok'
                      ? 'bg-success-soft/40 text-success'
                      : 'bg-danger-soft/40 text-danger'
                  }`}
                >
                  <span className="font-medium">{entry.month}</span>
                  <span className="text-ink-tertiary mx-1.5">·</span>
                  <span>{entry.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={fillBusy}
              className="btn-press flex-1 bg-accent hover:bg-accent-hover disabled:bg-divider text-white rounded-lg px-4 py-2.5 text-sm font-medium"
            >
              {fillBusy ? 'Generating...' : (fillLog.length > 0 ? 'Fill another month' : 'Generate data')}
            </button>
            {fillLog.length > 0 && (
              <button
                type="button"
                onClick={() => { setFillMonthOpen(false); setFillLog([]); }}
                disabled={fillBusy}
                className="btn-press border border-divider text-ink-secondary hover:bg-elevated rounded-lg px-4 py-2.5 text-sm font-medium"
              >
                Done
              </button>
            )}
          </div>
        </form>
      </Modal>
    </details>
  );
}
