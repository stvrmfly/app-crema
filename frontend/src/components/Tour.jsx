// TOUR: Interactive onboarding tour. To disable, flip TOUR_ENABLED to false.
// To remove entirely: delete this file + the {/* TOUR: ... */} blocks in Dashboard.jsx
// + the data-tour="..." attributes across the 4 pages + the CLAUDE.md "Onboarding" section.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';

export const TOUR_ENABLED = import.meta.env.DEV;
export const TOUR_DISMISSED_KEY = 'crema.tour-dismissed';

// ── Pub-sub so any page can request the tour and a single mount in App.jsx renders it ──
const TOUR_START_EVENT = 'crema:tour-start';
const TOUR_END_EVENT = 'crema:tour-end';
const DATA_CHANGED_EVENT = 'crema:data-changed';

// startTour() with no arg starts at step 0 (welcome). startTour(n) jumps to step n.
// Pages can call this to "resume" the tour at a specific point.
export function startTour(fromStep) {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { fromStep } }));
}
export function onTourStart(handler) {
  const wrapped = (e) => handler(e.detail?.fromStep);
  window.addEventListener(TOUR_START_EVENT, wrapped);
  return () => window.removeEventListener(TOUR_START_EVENT, wrapped);
}
export function onTourEnd(handler) {
  window.addEventListener(TOUR_END_EVENT, handler);
  return () => window.removeEventListener(TOUR_END_EVENT, handler);
}
// Pages should listen and call their own load() so freshly-created tour data renders immediately.
export function onDataChanged(handler) {
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}

// ── Helpers used inside step actions ──
const latestByName = (list, name) => {
  const matches = list.filter((x) => x.name === name);
  return matches[matches.length - 1];
};

// Step factories so each step's "action" can reference the next step's data idempotently.
const createCoffeeBeans = () =>
  api.createIngredient({
    name: 'Coffee Beans',
    unit: 'g',
    stockQuantity: 1000,
    costPerUnit: 150,
    lowStockThreshold: 200,
  });
const createMilk = () =>
  api.createIngredient({
    name: 'Milk',
    unit: 'ml',
    stockQuantity: 2000,
    costPerUnit: 30,
    lowStockThreshold: 500,
  });
const createCups = () =>
  api.createIngredient({
    name: 'Cup',
    unit: 'pcs',
    stockQuantity: 50,
    costPerUnit: 500,
    lowStockThreshold: 10,
  });
const createEspresso = async () => {
  const ingredients = await api.getIngredients();
  const beans = latestByName(ingredients, 'Coffee Beans');
  const cup = latestByName(ingredients, 'Cup');
  if (!beans || !cup) {
    throw new Error('Missing ingredients. Add them via the previous steps first.');
  }
  return api.createProduct({
    name: 'Espresso',
    price: 25000,
    recipe: [
      { ingredientId: beans.id, quantityRequired: 20 },
      { ingredientId: cup.id, quantityRequired: 1 },
    ],
  });
};
// ── waitFor helpers: each returns a (un)subscribe function used by step.waitFor ──
// They subscribe to user-driven UI events from Orders.jsx so the tour can advance
// on real interactions (not silent API calls).
const waitForEspressoInCart = ({ onSatisfied }) => {
  const handler = (e) => {
    const { cart, products } = e.detail || {};
    if (!cart || !products) return;
    const esp = products.find((p) => p.name === 'Espresso');
    if (esp && (cart[esp.id] ?? 0) > 0) onSatisfied();
  };
  window.addEventListener('crema:cart-changed', handler);
  return () => window.removeEventListener('crema:cart-changed', handler);
};
const waitForOrderPlaced = ({ onSatisfied }) => {
  const handler = () => onSatisfied();
  window.addEventListener('crema:order-placed', handler);
  return () => window.removeEventListener('crema:order-placed', handler);
};

// ── Step definitions (create-then-show: each step's `action` creates the data that
//    the NEXT step describes, so the visible state on screen always matches the tooltip).
const STEPS = [
  // 0. Welcome. Action creates Coffee Beans so it's visible on step 1.
  {
    title: 'Welcome to Crema',
    body: "Here's the plan: set up inventory, define a product, take a sample sale, then check the report. Takes about 90 seconds. We'll fill in realistic values, you confirm each step.",
    primaryLabel: "Let's start",
    category: null,
    action: createCoffeeBeans,
  },
  // 1. Coffee Beans row visible. Action creates Milk for step 2.
  {
    path: '/app/inventory',
    target: '[data-tour-ingredient="Coffee Beans"]',
    title: 'Coffee Beans',
    body: 'A 1 kg bag at Rp 150 per gram, which is typical Indonesian wholesale. The Dashboard will alert you when stock drops below 200 g.',
    primaryLabel: 'Add Milk',
    category: 'ingredients',
    action: createMilk,
  },
  // 2. Milk row visible. Action creates Cups for step 3.
  {
    path: '/app/inventory',
    target: '[data-tour-ingredient="Milk"]',
    title: 'Milk',
    body: 'Two liters at Rp 30 per ml. Alerts trigger when stock drops below 500 ml.',
    primaryLabel: 'Add Cups',
    category: 'ingredients',
    action: createCups,
  },
  // 3. Cup row visible. Action creates Espresso for step 4.
  {
    path: '/app/inventory',
    target: '[data-tour-ingredient="Cup"]',
    title: 'Cups',
    body: '50 paper cups at Rp 500 each. Alerts trigger when fewer than 10 remain.',
    primaryLabel: 'Create Espresso',
    category: 'ingredients',
    action: createEspresso,
  },
  // 4. Espresso visible on Products page. No data action — just intro before user takes a sale.
  {
    path: '/app/products',
    target: '[data-tour="products-table"]',
    title: 'Espresso',
    body: '20 g of beans and 1 cup, priced at Rp 25,000. The recipe is what tells Crema to deduct stock on every sale. Let\'s sell one.',
    primaryLabel: 'Sell one',
    category: 'product',
  },
  // 5. User-driven: add Espresso to cart. Tour waits for the cart to contain Espresso.
  {
    path: '/app/orders',
    target: '[data-tour-product="Espresso"] [data-tour="add-product"]',
    title: 'Add Espresso to the cart',
    body: 'Tap the + button next to Espresso to add one to the cart.',
    category: 'order',
    waitFor: waitForEspressoInCart,
  },
  // 6. User-driven: submit the order. Tour waits for crema:order-placed.
  {
    path: '/app/orders',
    target: '[data-tour="submit-order"]',
    title: 'Place the order',
    body: 'Tap Submit order to ring it up. Crema checks stock, deducts ingredients, and logs the sale.',
    category: 'order',
    waitFor: waitForOrderPlaced,
  },
  // 7. Sale placed. Cart reset. Just narrate and advance to Reports.
  {
    path: '/app/orders',
    target: '[data-tour="orders-cart"]',
    title: 'First sale',
    body: 'Order logged at Rp 25,000. Stock deducted automatically. Each new order appears in the Order History below.',
    primaryLabel: 'See the report',
    category: 'order',
  },
  // 8. Reports (finish).
  {
    path: '/app/reports',
    target: '[data-tour="reports-summary"]',
    title: 'It all lands here',
    body: "Revenue, cost, and profit for any date range. Your sample sale is already in here. Add more products and orders whenever you're ready, or hit Reset in the Dev Panel to start fresh.",
    primaryLabel: 'Finish',
    category: null,
  },
];

// Where in the tour should we resume given current data?
// Under the create-then-show model, each step's action creates the next data item,
// so the resume target is the step whose action would create the first missing item.
function computeResumeStep({ ingredients, products, orders }) {
  if (ingredients < 1) return 0; // Welcome step will create Coffee Beans
  if (ingredients < 2) return 1; // Coffee Beans visible, will create Milk
  if (ingredients < 3) return 2; // Milk visible, will create Cups
  if (products < 1) return 3;    // Cups visible, will create Espresso
  if (orders < 1) return 4;      // Espresso visible; the next two steps are user-driven (add + submit)
  return 7;                      // Sale already exists, jump to the wrap-up on Orders
}
// Exposed so Dashboard's checklist can compute the same resume target.
// We always derive from data, which guarantees prerequisites are met. E.g. clicking
// "Take an order" when only 2 ingredients exist resumes at the next ingredient step
// rather than jumping to the order step and failing.
export function resumeStepFor(_category, counts) {
  return computeResumeStep(counts);
}

// Mini progress panel's fixed footprint in the bottom-right (right-5 bottom-5 w-56).
// The tooltip's positioning logic treats this rect as forbidden so the panel never
// obscures the tooltip's primary action button at steps where the target is near the
// bottom-right corner of the viewport (e.g. the "First sale" step's cart spotlight).
const PANEL_RIGHT_INSET = 20;
const PANEL_BOTTOM_INSET = 20;
const PANEL_W = 224;
const PANEL_H = 140; // approximate — 3 rows + header + padding

function computeTooltipPos(rect, tooltipW, tooltipH, gap = 20) {
  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.bottom + gap;
  if (top + tooltipH > vh - margin) {
    const above = rect.top - tooltipH - gap;
    top = above >= margin ? above : Math.max(margin, vh - tooltipH - margin);
  }

  let left = rect.left + rect.width / 2 - tooltipW / 2;
  if (left < margin) left = margin;
  if (left + tooltipW > vw - margin) left = vw - margin - tooltipW;

  // Avoid the mini progress panel. If the proposed tooltip overlaps the panel's
  // reserved bottom-right zone, prefer shifting left (so the tooltip's right edge sits
  // to the left of the panel). If there's not enough horizontal room, shift the tooltip
  // up so its bottom edge sits above the panel's top instead.
  const panelLeft = vw - PANEL_RIGHT_INSET - PANEL_W;
  const panelTop = vh - PANEL_BOTTOM_INSET - PANEL_H;
  const overlapsPanel = left + tooltipW > panelLeft && top + tooltipH > panelTop;
  if (overlapsPanel) {
    const shiftedLeft = panelLeft - margin - tooltipW;
    if (shiftedLeft >= margin) {
      left = shiftedLeft;
    } else {
      top = Math.max(margin, panelTop - margin - tooltipH);
    }
  }

  return { top, left };
}

// a11y: stable ids let aria-labelledby/aria-describedby on the dialog point at the
// step's title/body. The id values themselves don't matter, just that they're unique
// and stable across the lifetime of this Tour mount.
let tourIdCounter = 0;

export default function Tour({ initialStep = 0, onClose }) {
  const [idx, setIdx] = useState(initialStep);
  const [rect, setRect] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const titleIdRef = useRef(`tour-title-${++tourIdCounter}`);
  const bodyIdRef = useRef(`tour-body-${tourIdCounter}`);
  const primaryBtnRef = useRef(null);
  // Tracks step indices whose `action` has already run successfully this session.
  // Lets Back/Next be safe: revisiting a done step is a no-op advance, not a re-create.
  const [completedSteps, setCompletedSteps] = useState(() => new Set());
  // ringStale: flipped to true the instant a step changes, flipped back to false once the
  // new rect lands. While stale, the ring is hidden (opacity 0, no transition) so it never
  // appears at a position that doesn't match the current step.
  const [ringStale, setRingStale] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;
  const stepDone = completedSteps.has(idx);

  // Resolve target after possible navigation. Every step change makes the ring "stale"
  // (hidden instantly), and we only un-stale once the new target's rect is measured.
  useEffect(() => {
    if (step.target) setRingStale(true);

    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
      return;
    }
    if (!step.target) {
      setRect({ center: true });
      setRingStale(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let rafId = null;
    // Track position with a per-frame loop. ResizeObserver only fires on SIZE changes;
    // we need to follow elements that MOVE (e.g. the Submit button shifts down when the
    // cart's grid-template-rows transitions open). rAF + getBoundingClientRect is the
    // standard pattern used by Popper/Floating UI for exactly this reason.
    const startTracking = (el) => {
      let lastTop = NaN, lastLeft = NaN, lastW = NaN, lastH = NaN;
      const tick = () => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        if (r.top !== lastTop || r.left !== lastLeft || r.width !== lastW || r.height !== lastH) {
          lastTop = r.top; lastLeft = r.left; lastW = r.width; lastH = r.height;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right });
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    };
    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right });
          setRingStale(false);
          startTracking(el);
        }, 350);
      } else if (attempts++ < 40) {
        setTimeout(tryFind, 50);
      } else {
        setRect({ center: true });
        setRingStale(false);
      }
    };
    tryFind();
    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [idx, location.pathname, step.path, step.target, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowLeft' && idx > 0 && !busy) setIdx((i) => i - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, busy]);

  // User-driven steps: subscribe to the step's waitFor, advance when satisfied.
  // The `done` flag guards against late events after the step has already changed.
  useEffect(() => {
    if (!step.waitFor) return undefined;
    let done = false;
    const cleanup = step.waitFor({
      onSatisfied: () => {
        if (done) return;
        done = true;
        setIdx((i) => i + 1);
      },
    });
    return cleanup;
  }, [idx, step.waitFor]);

  // a11y: move keyboard focus onto the tooltip's primary action when a new step
  // settles. Skipped for user-driven steps so focus can rest on the page (e.g.
  // the spotlighted "+" or Submit button) which is what the user needs to press.
  // `rect` is in deps so this fires once the dialog actually renders (rect goes from
  // null → measured), not just on idx change.
  useEffect(() => {
    if (ringStale || step.waitFor || !rect) return;
    primaryBtnRef.current?.focus();
  }, [idx, ringStale, step.waitFor, rect]);

  function handleClose() {
    window.dispatchEvent(new CustomEvent(TOUR_END_EVENT));
    onClose();
  }

  async function runPrimary() {
    if (busy) return;
    setActionError(null);
    if (isLast) return handleClose();
    // No action, or this step's action already succeeded in this session: just advance.
    if (!step.action || stepDone) {
      setIdx((i) => i + 1);
      return;
    }
    setBusy(true);
    try {
      await step.action();
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setIdx((i) => i + 1);
    } catch (e) {
      setActionError(e.message || 'Something went wrong. Try again?');
    } finally {
      setBusy(false);
    }
  }

  if (!rect) return null;

  const isCenter = !!rect.center;
  const tooltipW = 380;
  const tooltipH = 220;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const tooltipPos = isCenter
    ? { top: Math.max(16, (vh - tooltipH) / 2), left: Math.max(16, (vw - tooltipW) / 2) }
    : computeTooltipPos(rect, tooltipW, tooltipH);

  // Ring: instant disappear on every step change, graceful 200ms fade-in once the new
  // target is measured. Position never animates — changes happen while opacity is 0.
  const ringTransition = ringStale ? 'opacity 0ms' : 'opacity 200ms ease-out';
  // User-driven steps need clicks to reach the highlighted element, so we swap the
  // full-screen backdrop for a box-shadow "hole" that visually dims the surround but
  // passes pointer events through everywhere.
  const isWaiting = !!step.waitFor;
  const primaryLabel = actionError
    ? 'Retry'
    : stepDone && step.action
      ? 'Continue'
      : (step.primaryLabel ?? (isLast ? 'Finish' : 'Next'));

  return (
    <>
      {!isWaiting && (
        <div className="fixed inset-0 z-40 bg-black/35 animate-fade-in" onClick={handleClose} />
      )}
      {isWaiting && !isCenter && !ringStale && (
        <div
          className="fixed z-40 pointer-events-none rounded-xl animate-fade-in"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
          }}
        />
      )}

      <div
        className="tour-spotlight fixed z-[41] pointer-events-none rounded-xl"
        style={{
          top: isCenter ? vh / 2 : rect.top - 6,
          left: isCenter ? vw / 2 : rect.left - 6,
          width: isCenter ? 0 : rect.width + 12,
          height: isCenter ? 0 : rect.height + 12,
          opacity: isCenter || ringStale ? 0 : 1,
          transition: ringTransition,
        }}
      />

      <TourProgressPanel idx={idx} />

      {!ringStale && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleIdRef.current}
        aria-describedby={bodyIdRef.current}
        style={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: tooltipW,
        }}
        className="z-50 bg-card rounded-2xl shadow-overlay border border-divider/60 p-5 animate-fade-in"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] tracking-wider text-ink-tertiary uppercase">
            Step {idx + 1} of {STEPS.length}
          </span>
          <button
            onClick={handleClose}
            className="icon-btn text-ink-tertiary hover:text-ink-secondary p-1 rounded"
            aria-label="Close tour"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div key={idx}>
          {isLast && (
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-success-soft mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                <polyline points="20 6 9 17 4 12" className="animate-check-draw" style={{ strokeDasharray: 24 }} />
              </svg>
            </div>
          )}
          <h3 id={titleIdRef.current} className="font-heading text-xl text-ink mb-2">{step.title}</h3>
          <p id={bodyIdRef.current} className="text-sm text-ink-secondary leading-relaxed mb-3">{step.body}</p>
          {actionError && (
            <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-xl p-2.5 text-xs mb-3">
              {actionError}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleClose}
            disabled={busy}
            className="text-xs text-ink-tertiary hover:text-ink-secondary disabled:opacity-40"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {idx > 0 && (
              <button
                onClick={() => !busy && setIdx(idx - 1)}
                disabled={busy}
                className="btn-press border border-divider text-ink-secondary hover:bg-elevated disabled:opacity-40 rounded-lg px-3 py-1.5 text-sm"
              >
                Back
              </button>
            )}
            {isWaiting ? (
              <span className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-ink-tertiary bg-elevated border border-divider/60">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Waiting for you
              </span>
            ) : (
              <button
                ref={primaryBtnRef}
                onClick={runPrimary}
                disabled={busy}
                className="btn-press bg-accent hover:bg-accent-hover disabled:bg-divider text-white rounded-lg px-4 py-1.5 text-sm font-medium flex items-center gap-2"
              >
                {busy && (
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {busy ? 'Working…' : primaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
}

// ── Floating progress panel (top-right) ──
// Shows the three checklist items with live progress derived from the current step idx.
// Renders inside <Tour /> so it shares state and unmounts together.

function TourProgressPanel({ idx }) {
  // Derive done/current state from idx. Each row corresponds to a category.
  // Step map: 0=welcome, 1-3=ingredients, 4=product, 5=add-to-cart, 6=submit, 7=wrap-up, 8=reports.
  const ingredientsDone = Math.min(3, Math.max(0, idx - 1));
  const productsDone = idx >= 5 ? 1 : 0;
  const ordersDone = idx >= 7 ? 1 : 0;

  const rows = [
    { label: 'Ingredients', count: `${ingredientsDone}/3`, done: ingredientsDone >= 3, current: idx >= 1 && idx <= 3 },
    { label: 'Product', count: `${productsDone}/1`, done: productsDone >= 1, current: idx === 4 },
    { label: 'Sale', count: `${ordersDone}/1`, done: ordersDone >= 1, current: idx === 5 || idx === 6 },
  ];

  return (
    <div
      className="fixed z-[51] right-5 bottom-5 w-56 bg-card rounded-xl shadow-overlay border border-divider/60 p-3 animate-fade-in"
    >
      <div className="font-mono text-[10px] tracking-wider text-ink-tertiary uppercase mb-2 px-1">
        Tour progress
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li
            key={r.label}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
              r.current ? 'bg-accent-soft' : ''
            }`}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                r.done
                  ? 'bg-success text-white'
                  : r.current
                    ? 'bg-accent text-white'
                    : 'bg-elevated border border-divider text-ink-tertiary'
              }`}
            >
              {r.done ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : r.current ? (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              ) : null}
            </span>
            <span className={`flex-1 text-xs ${r.done ? 'text-ink-tertiary line-through' : 'text-ink'}`}>
              {r.label}
            </span>
            <span className="font-mono text-[10px] text-ink-tertiary">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
