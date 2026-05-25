import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupiah } from '../services/api.js';
import { onDataChanged } from '../components/Tour.jsx'; // TOUR
import Skeleton from '../components/Skeleton.jsx';
import {
  CartIcon,
  CubeIcon,
  ClockIcon,
  UndoIcon,
  CheckIcon,
  AlertTriangleIcon,
} from '../components/Icons.jsx';

// On Mac keyboards the key is labeled "return"; on everything else, "Enter".
// Same DOM event (e.key === 'Enter') in both cases — only the user-facing label changes.
const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || '');
const ENTER_LABEL = IS_MAC ? 'Return' : 'Enter';

export default function Orders() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // productId -> quantity
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shortages, setShortages] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // For 5-second undo of the just-placed order. Cleared on undo or after the timeout.
  // Keyboard-driven quantity control: a single product can be "active" at a time.
  // Enter → +1 on the active product. Right Shift → -1. Click any product card to activate it.
  const [activeProductId, setActiveProductId] = useState(null);
  const [pendingUndoOrderId, setPendingUndoOrderId] = useState(null);
  // After a successful Undo, the banner morphs to a "voided" look for ~1.5s.
  // This state drives the icon swap, text, and background tint.
  const [undoneOrderId, setUndoneOrderId] = useState(null);
  const undoTimerRef = useRef(null);
  const voidedTimerRef = useRef(null);
  // a11y: pause toast auto-dismiss while the user is interacting with it (hover or focus).
  // toastPauseCounter re-keys the drain bar on resume so the visual countdown restarts in sync.
  const [toastPaused, setToastPaused] = useState(false);
  const [toastPauseCounter, setToastPauseCounter] = useState(0);

  function startUndoTimer() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setPendingUndoOrderId(null);
      setConfirmationVisible(false);
      setTimeout(() => setConfirmation(null), 300);
    }, 5000);
  }
  function pauseToast() {
    setToastPaused((wasPaused) => {
      if (wasPaused) return true;
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      return true;
    });
  }
  function resumeToast() {
    setToastPaused((wasPaused) => {
      if (!wasPaused) return false;
      if (pendingUndoOrderId == null) return false;
      setToastPauseCounter((c) => c + 1);
      startUndoTimer();
      return false;
    });
  }
  function handleToastBlur(e) {
    // Only resume if focus actually left the toast (not just moved between its children).
    if (!e.currentTarget.contains(e.relatedTarget)) resumeToast();
  }

  // Order history
  const [orders, setOrders] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadProducts() {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadProducts(); }, []);
  useEffect(() => onDataChanged(loadProducts), []); // TOUR
  // TOUR: broadcast cart state so the tour's "Add Espresso" step can detect the +1.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('crema:cart-changed', { detail: { cart, products } }));
  }, [cart, products]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) loadHistory();
  }

  function setQty(productId, qty) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  // Reads cart state functionally so they're safe to call from event handlers
  // that might hold stale closures (e.g., the keyboard listener below).
  function increment(productId) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }
  function decrement(productId) {
    setCart((prev) => {
      const nextQty = (prev[productId] ?? 0) - 1;
      const next = { ...prev };
      if (nextQty <= 0) delete next[productId];
      else next[productId] = nextQty;
      return next;
    });
  }

  const cartLines = Object.entries(cart).map(([id, qty]) => {
    const product = products.find((p) => p.id === Number(id));
    return { product, quantity: qty };
  });
  const total = cartLines.reduce(
    (sum, line) => sum + Number(line.product?.price ?? 0) * line.quantity,
    0
  );

  async function submit() {
    if (cartLines.length === 0) return;
    setSubmitting(true);
    setShortages(null);
    setConfirmation(null);
    setConfirmationVisible(false);
    setError(null);
    try {
      const order = await api.createOrder(
        cartLines.map((l) => ({ productId: l.product.id, quantity: l.quantity }))
      );
      setCart({});
      // TOUR: signal the user-driven submit so the tour can advance past its "Place the order" step.
      window.dispatchEvent(new CustomEvent('crema:order-placed', { detail: { order } }));
      window.dispatchEvent(new CustomEvent('crema:data-changed'));
      setConfirmation(`Order #${order.id} placed, ${formatRupiah(order.total)}`);
      setConfirmationVisible(true);
      setPendingUndoOrderId(order.id);
      startUndoTimer();
      // Refresh history if open
      if (showHistory) loadHistory();
    } catch (e) {
      if (e.status === 400 && e.data?.shortages) {
        setShortages(e.data.shortages);
      } else {
        setError(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function undoLastOrder() {
    if (pendingUndoOrderId == null) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (voidedTimerRef.current) clearTimeout(voidedTimerRef.current);

    const undoneId = pendingUndoOrderId;
    // Optimistic: morph the banner instantly. Bar unmounts because pendingUndoOrderId
    // is null; icon, text, and tint swap based on undoneOrderId.
    setUndoneOrderId(undoneId);
    setPendingUndoOrderId(null);
    setConfirmation(`Order #${undoneId} voided, stock restored`);

    // Hold the voided look for 1.5s then fade out.
    voidedTimerRef.current = setTimeout(() => {
      setConfirmationVisible(false);
      setTimeout(() => {
        setConfirmation(null);
        setUndoneOrderId(null);
      }, 300);
    }, 1500);

    // Fire-and-forget API call. If it fails, surface an error but leave the UI
    // in its undone state since the user already saw the void confirmation.
    try {
      await api.deleteOrder(undoneId);
      if (showHistory) loadHistory();
    } catch (e) {
      setError(`Couldn't void Order #${undoneId}: ${e.message}`);
    }
  }

  // Clean up auto-hide + voided timers when this component unmounts.
  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (voidedTimerRef.current) clearTimeout(voidedTimerRef.current);
  }, []);

  // Keyboard shortcuts for the active product. Enter = +1, Right Shift = -1.
  // Only attaches the listener when a product is active; cleanly removed otherwise
  // (or when this page unmounts). `increment` / `decrement` read state functionally
  // so a stale closure here is safe.
  useEffect(() => {
    if (activeProductId == null) return undefined;
    function onKey(e) {
      // Skip when the user is typing in a field, in case modals or other inputs gain focus.
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        increment(activeProductId);
      } else if (e.code === 'ShiftRight' || (e.key === 'Shift' && e.location === 2)) {
        // `e.code === 'ShiftRight'` is the primary detection. The location check is a
        // fallback for browsers that may not populate `code` for modifier keys.
        e.preventDefault();
        decrement(activeProductId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProductId]);

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-8">
      <div className="relative flex items-center justify-between">
        {confirmation && (
          <div
            role="status"
            aria-live="polite"
            onMouseEnter={pauseToast}
            onMouseLeave={resumeToast}
            onFocus={pauseToast}
            onBlur={handleToastBlur}
            className={`pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-[clamp(320px,_50%,_42rem)] flex items-center gap-2.5 border rounded-xl py-2 pl-3 pr-2 text-sm shadow-ambient transition-colors duration-300 ease-out overflow-hidden ${
              undoneOrderId != null
                ? 'bg-elevated border-divider/60 text-ink-secondary'
                : 'bg-success-soft border-success/20 text-ink'
            }`}
            style={{
              opacity: confirmationVisible ? 1 : 0,
              transform: `translate(-50%, calc(-50% + ${confirmationVisible ? '0px' : '-8px'}))`,
              transition: 'opacity 200ms ease, transform 200ms ease, background-color 300ms ease, border-color 300ms ease, color 300ms ease',
            }}
          >
            <div
              key={undoneOrderId != null ? 'voided' : 'placed'}
              className={`animate-pop flex-shrink-0 ${undoneOrderId != null ? 'text-ink-secondary' : 'text-success'}`}
            >
              {undoneOrderId != null ? (
                <UndoIcon className="w-4 h-4" />
              ) : (
                <CheckIcon className="w-4 h-4" strokeWidth={2.25} />
              )}
            </div>
            <span key={confirmation} className="flex-1 animate-fade-in truncate">{confirmation}</span>
            {pendingUndoOrderId != null && (
              <button
                type="button"
                onClick={undoLastOrder}
                className="btn-press font-mono text-[11px] uppercase tracking-wider text-success-hover hover:text-success underline underline-offset-2 px-1"
              >
                Undo
              </button>
            )}
            {pendingUndoOrderId != null && (
              <div
                key={`${pendingUndoOrderId}-${toastPauseCounter}`}
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-success-hover/45 origin-left"
                style={{ animation: 'drain 5000ms linear forwards', animationPlayState: toastPaused ? 'paused' : 'running' }}
              />
            )}
          </div>
        )}
        <h1 className="text-3xl font-heading text-ink flex items-center gap-3">
          <CartIcon className="w-7 h-7 text-accent" />
          Orders
        </h1>
        <button
          type="button"
          onClick={toggleHistory}
          aria-expanded={showHistory}
          className="btn-press border border-divider text-ink-secondary hover:bg-elevated rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
        >
          <ClockIcon className="w-4 h-4" />
          {showHistory ? 'Hide history' : 'Order history'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-xs text-ink-tertiary uppercase">Menu</h2>
            <div className="flex items-center gap-3 font-mono text-[10px] text-ink-tertiary">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 border border-divider rounded bg-card text-ink-secondary leading-none">{ENTER_LABEL}</kbd>
                <span className="text-sm leading-none text-ink-secondary">+</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 border border-divider rounded bg-card text-ink-secondary leading-none">rShift</kbd>
                <span className="text-sm leading-none text-ink-secondary">−</span>
              </span>
            </div>
          </div>
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="4.5rem" />)}
            </div>
          )}
          {!loading && products.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center min-h-[280px]">
              <CubeIcon className="w-12 h-12 text-ink-tertiary/40 mb-3" strokeWidth={1} />
              <p className="text-ink-tertiary text-sm">No products available</p>
              <p className="text-ink-tertiary text-sm mt-1">
                Add some in <Link to="/products" className="text-ink font-medium underline decoration-accent/40 hover:decoration-accent">Products</Link> first.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              const isActive = activeProductId === p.id;
              return (
                <div
                  key={p.id}
                  data-tour-product={p.name}
                  onClick={() => setActiveProductId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveProductId(p.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${p.name}, ${formatRupiah(p.price)}`}
                  aria-pressed={isActive}
                  className={`rounded-2xl p-4 border cursor-pointer transition-[border-color,background-color,box-shadow] duration-150 ${
                    isActive
                      ? 'border-accent shadow-lifted bg-accent-soft/50'
                      : qty > 0
                        ? 'border-accent/40 shadow-md bg-accent-soft/30'
                        : 'border-divider/40 shadow-ambient hover:border-divider/60 hover:bg-elevated/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-heading text-lg text-ink truncate leading-tight">{p.name}</div>
                      <div className="font-mono text-xs text-ink-secondary tabular mt-0.5">
                        {formatRupiah(p.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); decrement(p.id); }}
                        disabled={qty === 0}
                        aria-label={`Remove one ${p.name}`}
                        className="btn-press hit-target w-9 h-9 inline-flex items-center justify-center border border-divider rounded-lg text-ink hover:bg-elevated disabled:opacity-40 text-lg leading-none"
                      >
                        −
                      </button>
                      <div
                        key={qty}
                        aria-live="polite"
                        aria-label={`${qty} ${p.name} in cart`}
                        className={
                          'w-7 text-center tabular text-ink ' +
                          (qty > 0 ? 'animate-pop' : '')
                        }
                      >
                        {qty}
                      </div>
                      <button
                        type="button"
                        data-tour="add-product"
                        onClick={(e) => { e.stopPropagation(); increment(p.id); }}
                        aria-label={`Add one ${p.name}`}
                        className="btn-press hit-target w-9 h-9 inline-flex items-center justify-center border border-divider rounded-lg text-ink hover:bg-elevated text-lg leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* lg:sticky keeps the cart in view while scrolling a long menu. self-start
            prevents it from stretching to the menu column's height. top-6 matches the
            page's visual breathing room from the shell's rounded edge. max-h + overflow
            protects against very tall carts on short viewports: the aside scrolls
            internally if shortages + cart together exceed the visible area. */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
          {shortages && (
            <div role="alert" className="animate-shake bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4" />
                Insufficient stock
              </div>
              <ul className="text-sm space-y-1 tabular">
                {shortages.map((s) => (
                  <li key={s.ingredientId}>
                    {s.name}: need {s.required} {s.unit}, have {s.available} {s.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4 text-sm">
              {error}
            </div>
          )}

          <section data-tour="orders-cart" className="card-gradient border border-divider/60 rounded-2xl shadow-lifted p-6 flex flex-col">
            <h2 className="font-mono text-xs text-ink-tertiary uppercase mb-4">Current Order</h2>
            <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: cartLines.length === 0 ? '0fr' : '1fr' }}>
              <div className="overflow-hidden">
                <div className="space-y-2 mb-4">
                  {cartLines.map((line) => (
                    <div key={line.product.id} className="flex justify-between text-sm">
                      <span className="text-ink-secondary">
                        {line.product.name} × {line.quantity}
                      </span>
                      <span className="text-ink tabular">
                        {formatRupiah(Number(line.product.price) * line.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {cartLines.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-6">
                <CartIcon className="w-8 h-8 text-ink-tertiary/40 mb-2" strokeWidth={1.25} />
                <div className="font-heading text-base text-ink-secondary">Your cart is empty</div>
                <div className="text-xs text-ink-tertiary mt-1">Tap a drink from the menu to start</div>
              </div>
            )}
            <div className="border-t border-divider pt-4 flex items-baseline justify-between mb-4">
              <span className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">Total</span>
              <span className="font-heading text-2xl text-ink tabular leading-none">
                {formatRupiah(total)}
              </span>
            </div>
            <button
              type="button"
              data-tour="submit-order"
              onClick={submit}
              disabled={cartLines.length === 0 || submitting}
              aria-label={cartLines.length === 0 ? 'Submit order (cart is empty)' : `Submit order, total ${formatRupiah(total)}`}
              aria-busy={submitting}
              className="btn-press w-full bg-cta hover:bg-cta-hover disabled:bg-divider text-white rounded-lg px-4 py-2.5 font-medium text-sm inline-flex items-center justify-center gap-2"
            >
              {submitting && (
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
              {submitting ? 'Submitting...' : 'Submit order'}
            </button>
          </section>
        </aside>
      </div>

      {/* Mobile sticky-bottom cart summary — visible below lg, only when cart has items.
          Mirrors total + Submit so the operator never has to scroll to the bottom of the
          page on a phone/tablet. The full cart panel above still shows line items. */}
      {cartLines.length > 0 && (
        <div
          role="region"
          aria-label="Cart summary"
          className="lg:hidden sticky bottom-4 z-30 mt-6 px-4 py-3 bg-card/95 backdrop-blur border border-divider/60 rounded-xl shadow-overlay flex items-center gap-3 animate-fade-up"
        >
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] text-ink-tertiary uppercase tracking-wider">
              {cartLines.length} item{cartLines.length === 1 ? '' : 's'}
            </div>
            <div className="font-heading text-xl text-ink tabular leading-none mt-0.5">
              {formatRupiah(total)}
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            aria-label={`Submit order, total ${formatRupiah(total)}`}
            aria-busy={submitting}
            className="btn-press bg-cta hover:bg-cta-hover disabled:bg-divider text-white rounded-lg px-5 py-2.5 font-medium text-sm inline-flex items-center gap-2"
          >
            {submitting && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
            {submitting ? 'Submitting...' : 'Submit order'}
          </button>
        </div>
      )}

      {/* Order history */}
      {showHistory && (
        <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6 animate-fade-up">
          <h2 className="font-mono text-xs text-ink-tertiary uppercase mb-4">Order History</h2>
          {historyLoading && <p className="text-ink-secondary text-sm">Loading...</p>}
          {!historyLoading && orders.length === 0 && (
            <p className="text-ink-tertiary text-sm text-center py-8">No orders placed yet.</p>
          )}
          {orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-divider/60 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-ink">Order #{order.id}</span>
                    <span className="font-mono text-xs text-ink-tertiary">{formatTime(order.createdAt)}</span>
                  </div>
                  <div className="space-y-1 mb-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-ink-secondary">
                        <span>{item.product.name} × {item.quantity}</span>
                        <span className="tabular">{formatRupiah(Number(item.unitPrice) * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-divider/60 pt-2 flex justify-between text-sm">
                    <span className="font-medium text-ink">Total</span>
                    <span className="font-medium text-ink tabular">{formatRupiah(order.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
