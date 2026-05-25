import { useState, useRef, useEffect } from 'react';

// 11 warm/earthy hues spaced ~30° apart on the color wheel.
// All sit at similar saturation (~40-50%) and lightness (~50%) to keep the
// organic, low-vibrance feel. Ordered around the wheel so adjacent palette
// slots are never near-duplicates.
const CHART_COLORS = [
  '#b8593a', // 1.  warm sienna
  '#d4805c', // 2.  peach terracotta
  '#c4923a', // 3.  golden ochre
  '#9c9540', // 4.  olive
  '#6d9450', // 5.  moss
  '#4a9e6e', // 6.  forest sage
  '#4a9e96', // 7.  dusty teal
  '#5a85ab', // 8.  steel blue
  '#7570b8', // 9.  periwinkle
  '#b070a8', // 10. mauve
  '#c45a6e', // 11. dusty rose
];

// Neutral warm-gray for the "Others" rollup — distinct from any palette hue.
const OTHERS_COLOR = '#a8a098';

// When more than this many products exist, the lowest-share ones collapse
// into a single "Others" slice. Set so "Others" always represents ≥ 2 items.
const MAX_VISIBLE_SLICES = 10;

const DONUT_SIZE = 160;
const DONUT_CENTER = DONUT_SIZE / 2;
const STROKE_WIDTH = 30;
const RADIUS = (DONUT_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ProductMixChart({ products, totalRevenue, orderCount, formatRupiah }) {
  // `hovered` is unified: either { kind: 'slice', index } for top-level rows
  // or { kind: 'sub', index } for rolled-up items inside Others.
  const [hovered, setHovered] = useState(null);
  const [othersExpanded, setOthersExpanded] = useState(false);
  const tooltipRef = useRef(null);
  const sliceRowRefs = useRef([]);
  const subRowRefs = useRef([]);

  // Reset expansion if the underlying products change (range switch, reseed, etc).
  const productsKey = (products || []).map((p) => p.name).join('|');
  useEffect(() => {
    setOthersExpanded(false);
    setHovered(null);
  }, [productsKey]);

  if (!products || products.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-tertiary text-sm">
        No sales yet
      </div>
    );
  }

  // Roll up small-share products into "Others" when the list is long.
  // Only rolls up if it would group ≥ 2 items.
  const sorted = [...products].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const shouldRollup = sorted.length > MAX_VISIBLE_SLICES + 1;
  let displayProducts;
  let othersItems = [];
  if (shouldRollup) {
    const top = sorted.slice(0, MAX_VISIBLE_SLICES);
    othersItems = sorted.slice(MAX_VISIBLE_SLICES).map((p) => ({
      ...p,
      share: totalRevenue > 0 ? (Number(p.revenue) / totalRevenue) * 100 : 0,
    }));
    const othersAgg = othersItems.reduce(
      (acc, p) => {
        acc.revenue += Number(p.revenue);
        acc.cost += Number(p.cost || 0);
        acc.quantity += Number(p.quantity || 0);
        return acc;
      },
      { revenue: 0, cost: 0, quantity: 0 }
    );
    const othersProfit = othersAgg.revenue - othersAgg.cost;
    displayProducts = [
      ...top,
      {
        name: `Others (${othersItems.length})`,
        revenue: othersAgg.revenue,
        cost: othersAgg.cost,
        quantity: othersAgg.quantity,
        profit: othersProfit,
        margin: othersAgg.revenue > 0 ? (othersProfit / othersAgg.revenue) * 100 : 0,
        share: totalRevenue > 0 ? (othersAgg.revenue / totalRevenue) * 100 : 0,
        isOthers: true,
      },
    ];
  } else {
    displayProducts = sorted;
  }

  // Donut slices
  const GAP = 4;
  const totalGap = GAP * displayProducts.length;
  const usable = CIRCUMFERENCE - totalGap;
  let cumulativeOffset = 0;
  const slices = displayProducts.map((p, i) => {
    const share = totalRevenue > 0 ? Number(p.revenue) / totalRevenue : 0;
    const dashLen = Math.max(0, share * usable);
    const gapLen = CIRCUMFERENCE - dashLen;
    const offset = -cumulativeOffset;
    cumulativeOffset += dashLen + GAP;
    return {
      ...p,
      color: p.isOthers ? OTHERS_COLOR : CHART_COLORS[i % CHART_COLORS.length],
      dasharray: `${dashLen} ${gapLen}`,
      dashoffset: offset,
      index: i,
    };
  });

  // Resolve the hovered product for tooltip + donut highlighting
  let hoveredProduct = null;
  let hoveredAnchorRef = null;
  let highlightedSliceIndex = null;
  if (hovered) {
    if (hovered.kind === 'slice') {
      hoveredProduct = slices[hovered.index];
      hoveredAnchorRef = sliceRowRefs.current[hovered.index];
      highlightedSliceIndex = hovered.index;
    } else if (hovered.kind === 'sub') {
      hoveredProduct = othersItems[hovered.index];
      hoveredAnchorRef = subRowRefs.current[hovered.index];
      // Sub-items live under the Others slice — highlight that slice too
      const othersSliceIndex = slices.findIndex((s) => s.isOthers);
      highlightedSliceIndex = othersSliceIndex >= 0 ? othersSliceIndex : null;
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start gap-6">
      {/* Donut chart */}
      <div className="flex-shrink-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
        <svg
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          width={DONUT_SIZE}
          height={DONUT_SIZE}
          style={{ transform: 'rotate(-90deg)' }}
          role="img"
          aria-label={`Product revenue mix across ${displayProducts.length} products, total revenue ${totalRevenue}`}
        >
          <title>Product revenue mix</title>
          <desc>
            {displayProducts
              .map((p) => `${p.name}: ${Number(p.share ?? 0).toFixed(1)}%`)
              .join(', ')}
          </desc>
          {slices.map((s) => (
            <circle
              key={s.index}
              cx={DONUT_CENTER}
              cy={DONUT_CENTER}
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={s.dasharray}
              strokeDashoffset={s.dashoffset}
              style={{
                opacity: highlightedSliceIndex === s.index ? 0.75 : 1,
                transition: 'opacity 150ms ease-out',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHovered({ kind: 'slice', index: s.index })}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
      </div>

      {/* Tooltip — anchored above the hovered legend row */}
      {hoveredProduct && hoveredAnchorRef && (() => {
        const rowRect = hoveredAnchorRef.getBoundingClientRect();
        const tt = tooltipRef.current;
        const ttW = tt ? tt.offsetWidth : 200;
        let left = rowRect.left + rowRect.width / 2 - ttW / 2;
        const margin = 8;
        if (left + ttW > window.innerWidth - margin) left = window.innerWidth - margin - ttW;
        if (left < margin) left = margin;
        return (
          <div
            ref={tooltipRef}
            className="fixed z-50 pointer-events-none bg-ink text-white rounded-xl p-3 shadow-lg text-xs tabular max-w-[240px]"
            style={{
              left,
              top: rowRect.top - 8,
              transform: 'translateY(-100%)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              {/* Name wraps; metric rows below stay nowrap via the grid layout. */}
              <span className="font-medium break-words min-w-0">{hoveredProduct.name}</span>
              <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span className="text-white/60">Revenue</span>
              <span className="text-right">{formatRupiah(hoveredProduct.revenue)}</span>
              <span className="text-white/60">Quantity</span>
              <span className="text-right">{hoveredProduct.quantity}</span>
              <span className="text-white/60">Cost</span>
              <span className="text-right">{formatRupiah(hoveredProduct.cost)}</span>
              <span className="text-white/60">Profit</span>
              <span
                className="text-right"
                style={{ color: `rgb(var(${Number(hoveredProduct.profit) >= 0 ? '--chart-profit' : '--chart-loss'}))` }}
              >
                {formatRupiah(hoveredProduct.profit)}
              </span>
              <span className="text-white/60">Margin</span>
              <span className="text-right">{Number(hoveredProduct.margin).toFixed(1)}%</span>
              <span className="text-white/60">Share</span>
              <span className="text-right">{Number(hoveredProduct.share).toFixed(1)}%</span>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex-1 min-w-0">
        <div className="space-y-1.5">
          {slices.map((s) => {
            const isOthersRow = s.isOthers;
            const isExpanded = isOthersRow && othersExpanded;
            return (
              <div key={s.index}>
                <div
                  ref={(el) => (sliceRowRefs.current[s.index] = el)}
                  onClick={isOthersRow ? () => setOthersExpanded((v) => !v) : undefined}
                  onKeyDown={isOthersRow ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOthersExpanded((v) => !v);
                    }
                  } : undefined}
                  role={isOthersRow ? 'button' : undefined}
                  tabIndex={isOthersRow ? 0 : undefined}
                  aria-expanded={isOthersRow ? isExpanded : undefined}
                  aria-label={isOthersRow ? `${isExpanded ? 'Collapse' : 'Expand'} ${s.name}` : undefined}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 ${isOthersRow ? 'cursor-pointer select-none' : 'cursor-default'}`}
                  style={{
                    backgroundColor:
                      highlightedSliceIndex === s.index
                        ? 'rgb(var(--bg-elevated) / 0.7)'
                        : 'transparent',
                    transition: 'background-color 150ms ease-out',
                  }}
                  onMouseEnter={() => setHovered({ kind: 'slice', index: s.index })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span
                    className="flex-shrink-0 rounded-full"
                    style={{ width: 10, height: 10, backgroundColor: s.color }}
                  />
                  <span className="text-sm text-ink truncate flex-1 flex items-center gap-1.5">
                    {s.name}
                    {isOthersRow && (
                      <svg
                        className="w-3.5 h-3.5 text-ink-tertiary transition-transform motion-reduce:transition-none"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-ink tabular flex-shrink-0">
                    {formatRupiah(s.revenue)}
                  </span>
                  <span className="text-xs text-ink-tertiary tabular flex-shrink-0 w-12 text-right">
                    {Number(s.share).toFixed(1)}%
                  </span>
                </div>

                {/* Expandable sub-list for Others */}
                {isOthersRow && (
                  <div
                    className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none"
                    style={{
                      maxHeight: isExpanded ? `${othersItems.length * 32 + 8}px` : '0px',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div className="mt-1 ml-3 pl-3 border-l border-divider/70 space-y-0.5">
                      {othersItems.map((item, subIdx) => (
                        <div
                          key={item.name + subIdx}
                          ref={(el) => (subRowRefs.current[subIdx] = el)}
                          onMouseEnter={() => setHovered({ kind: 'sub', index: subIdx })}
                          onMouseLeave={() => setHovered(null)}
                          className="flex items-center gap-3 rounded-md px-2 py-1 -mx-2 cursor-default"
                          style={{
                            backgroundColor:
                              hovered?.kind === 'sub' && hovered.index === subIdx
                                ? 'rgb(var(--bg-elevated) / 0.6)'
                                : 'transparent',
                            transition: 'background-color 150ms ease-out',
                          }}
                        >
                          <span className="text-xs text-ink-secondary truncate flex-1">{item.name}</span>
                          <span className="text-xs text-ink-secondary tabular flex-shrink-0">
                            {formatRupiah(item.revenue)}
                          </span>
                          <span className="text-xs text-ink-tertiary tabular flex-shrink-0 w-12 text-right">
                            {Number(item.share).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-divider mt-3 pt-3 flex items-center justify-between px-2 -mx-2">
          <span className="text-sm font-medium text-ink">Total Revenue</span>
          <span className="text-sm font-semibold text-ink tabular">
            {formatRupiah(totalRevenue)}
          </span>
        </div>
      </div>

      {/* Accessible tabular fallback for screen readers — sighted users see nothing.
          Uses the un-rolled `sorted` list so SR users get the full breakdown. */}
      <table className="sr-only">
        <caption>Product revenue mix</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Quantity</th>
            <th scope="col">Revenue</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const share = totalRevenue > 0 ? (Number(p.revenue) / totalRevenue) * 100 : 0;
            return (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.quantity}</td>
                <td>{formatRupiah(p.revenue)}</td>
                <td>{share.toFixed(1)}%</td>
              </tr>
            );
          })}
          <tr>
            <td>Total</td>
            <td>{sorted.reduce((s, p) => s + Number(p.quantity || 0), 0)}</td>
            <td>{formatRupiah(totalRevenue)}</td>
            <td>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
