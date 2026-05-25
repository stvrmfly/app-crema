import { useState, useRef, useCallback, useMemo } from 'react';

const PADDING = { top: 20, right: 20, bottom: 32, left: 72 };
const VIEW_W = 700;
const VIEW_H = 260;
const CHART_W = VIEW_W - PADDING.left - PADDING.right;
const CHART_H = VIEW_H - PADDING.top - PADDING.bottom;

// Wire chart colors to the design tokens so we don't drift from the rest of the app
// when --accent / --ink-tertiary / --bg-divider get retuned.
const ACCENT = 'rgb(var(--accent))';
const ACCENT_FILL = 'rgb(var(--accent) / 0.08)';
const ACCENT_HOVER_FILL = 'rgb(var(--accent-hover) / 0.16)';
const GRID_COLOR = 'rgb(var(--bg-divider))';
const LABEL_COLOR = 'rgb(var(--ink-tertiary))';

function niceMax(val) {
  if (val <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  const normed = val / mag;
  if (normed <= 1) return mag;
  if (normed <= 2) return 2 * mag;
  if (normed <= 5) return 5 * mag;
  return 10 * mag;
}

function shortDateLabel(iso, granularity) {
  // iso = "YYYY-MM-DD"
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return granularity === 'weekly' ? `${d}/${m}` : `${parseInt(d, 10)}`;
}

function tooltipDateLabel(iso, granularity) {
  if (!iso) return '';
  if (granularity === 'weekly') {
    const start = new Date(iso + 'T00:00:00Z');
    const end = new Date(start.getTime() + 6 * 86400000);
    const fmt = (d) => d.toISOString().slice(5, 10);
    return `Week of ${fmt(start)} – ${fmt(end)}`;
  }
  return iso;
}

export default function MonthlySalesChart({ points, summary, granularity = 'daily', formatRupiah }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [hoveredSliceIdx, setHoveredSliceIdx] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  const allZero = !points || points.length === 0 || points.every((p) => Number(p.total) === 0);
  const maxVal = allZero ? 100 : niceMax(Math.max(...points.map((p) => Number(p.total))));
  const gridCount = 4;
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => (maxVal / gridCount) * i);

  // Pick ~6-8 x-axis label indices spread evenly across the range
  const labelIndices = useMemo(() => {
    if (!points || points.length === 0) return [];
    const targetCount = Math.min(7, points.length);
    if (points.length <= targetCount) return points.map((_, i) => i);
    const step = (points.length - 1) / (targetCount - 1);
    return Array.from({ length: targetCount }, (_, i) => Math.round(i * step));
  }, [points]);

  const xScale = useCallback(
    (idx) => {
      if (!points || points.length === 0) return PADDING.left;
      if (points.length === 1) return PADDING.left + CHART_W / 2;
      return PADDING.left + (idx / (points.length - 1)) * CHART_W;
    },
    [points]
  );

  const yScale = useCallback(
    (val) => PADDING.top + CHART_H - (Number(val) / maxVal) * CHART_H,
    [maxVal]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!points || points.length === 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
      const mouseY = ((e.clientY - rect.top) / rect.height) * VIEW_H;

      if (
        mouseX < PADDING.left ||
        mouseX > VIEW_W - PADDING.right ||
        mouseY < PADDING.top - 10 ||
        mouseY > VIEW_H - PADDING.bottom + 10
      ) {
        setHoveredIdx(null);
        setHoveredSliceIdx(null);
        return;
      }

      let closestIdx = -1;
      let closestDist = Infinity;
      points.forEach((_, i) => {
        const dx = Math.abs(xScale(i) - mouseX);
        if (dx < closestDist) {
          closestDist = dx;
          closestIdx = i;
        }
      });

      // Which slice (between two consecutive data points) is the cursor in?
      let sliceIdx = -1;
      for (let i = 0; i < points.length - 1; i++) {
        if (mouseX >= xScale(i) && mouseX < xScale(i + 1)) {
          sliceIdx = i;
          break;
        }
      }
      if (sliceIdx === -1 && points.length > 1 && mouseX >= xScale(points.length - 1)) {
        sliceIdx = points.length - 2;
      }
      setHoveredSliceIdx(sliceIdx >= 0 ? sliceIdx : null);

      const threshold = CHART_W / Math.max(points.length, 1);
      if (closestIdx >= 0 && closestDist < threshold) {
        setHoveredIdx(closestIdx);
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setHoveredIdx(null);
      }
    },
    [points, xScale]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
    setHoveredSliceIdx(null);
  }, []);

  let linePath = '';
  if (points && points.length > 0) {
    linePath = points.map((p, i) => `${xScale(i)},${yScale(p.total)}`).join(' ');
  }

  const hoveredPoint = hoveredIdx != null ? points[hoveredIdx] : null;

  return (
    <div className="space-y-4">
      <div className="relative">
        {allZero ? (
          <div className="flex flex-col items-center justify-center h-48 text-ink-tertiary text-sm">
            <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            Tidak ada pesanan dalam rentang ini
          </div>
        ) : (
          <div className="relative" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={`Sales over time, ${granularity}. ${points?.length ?? 0} data points.`}
            >
              <title>{`Sales over time (${granularity})`}</title>
              <desc>
                {summary
                  ? `Total revenue ${summary.totalRevenue}, ${summary.totalOrders} orders, average daily ${summary.avgDailyRevenue}.`
                  : 'Daily revenue trend'}
              </desc>
              {gridLines.map((val) => (
                <g key={val}>
                  <line
                    x1={PADDING.left}
                    y1={yScale(val)}
                    x2={VIEW_W - PADDING.right}
                    y2={yScale(val)}
                    stroke={GRID_COLOR}
                    strokeWidth={1}
                    strokeDasharray={val === 0 ? 'none' : '4 3'}
                  />
                  <text
                    x={PADDING.left - 8}
                    y={yScale(val) + 4}
                    textAnchor="end"
                    fill={LABEL_COLOR}
                    style={{ fontSize: 8, fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatRupiah(val)}
                  </text>
                </g>
              ))}

              {labelIndices.map((i) => (
                <text
                  key={`xl-${i}`}
                  x={xScale(i)}
                  y={VIEW_H - 6}
                  textAnchor="middle"
                  fill={LABEL_COLOR}
                  style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {shortDateLabel(points[i].label, granularity)}
                </text>
              ))}

              {/* Sliced area fill: one trapezoid per day-to-day segment, with alternating
                  opacity so the chart reads as a sequence of distinct cells. Hovered slice
                  darkens for an intensity bump. */}
              {points && points.length > 1 && (
                <g>
                  {points.slice(0, -1).map((p, i) => {
                    const x1 = xScale(i);
                    const y1 = yScale(p.total);
                    const x2 = xScale(i + 1);
                    const y2 = yScale(points[i + 1].total);
                    const baseY = yScale(0);
                    const isHovered = i === hoveredSliceIdx;
                    return (
                      <polygon
                        key={`slice-${i}`}
                        points={`${x1},${baseY} ${x1},${y1} ${x2},${y2} ${x2},${baseY}`}
                        fill={isHovered ? ACCENT_HOVER_FILL : ACCENT_FILL}
                        fillOpacity={isHovered ? 1 : (i % 2 === 0 ? 1 : 0.7)}
                        style={{ transition: 'fill 150ms ease-out, fill-opacity 150ms ease-out' }}
                      />
                    );
                  })}
                </g>
              )}

              {/* Dashed verticals at each interior data point, dividing the slices.
                  First and last points sit on the chart's edges, so they don't get a line. */}
              {points && points.length > 2 && (
                <g>
                  {points.slice(1, -1).map((p, idx) => {
                    const i = idx + 1;
                    const x = xScale(i);
                    return (
                      <line
                        key={`dash-${i}`}
                        x1={x}
                        y1={yScale(p.total)}
                        x2={x}
                        y2={yScale(0)}
                        stroke={GRID_COLOR}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        opacity={0.65}
                      />
                    );
                  })}
                </g>
              )}

              {linePath && (
                <polyline
                  points={linePath}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((p, i) => (
                <circle
                  key={`pt-${i}`}
                  cx={xScale(i)}
                  cy={yScale(p.total)}
                  r={hoveredIdx === i ? 5 : 2.5}
                  fill={ACCENT}
                  style={{ transition: 'r 150ms ease-out' }}
                />
              ))}
            </svg>

            {hoveredPoint && (() => {
              const container = svgRef.current?.parentElement;
              const containerW = container ? container.offsetWidth : 9999;
              const TOOLTIP_W = 190;
              const TOOLTIP_MARGIN = 8;
              let left = tooltipPos.x - TOOLTIP_W / 2;
              if (left + TOOLTIP_W > containerW - TOOLTIP_MARGIN) left = containerW - TOOLTIP_MARGIN - TOOLTIP_W;
              if (left < TOOLTIP_MARGIN) left = TOOLTIP_MARGIN;
              return (
                <div
                  className="absolute z-20 pointer-events-none bg-ink text-white rounded-xl p-3 shadow-lg text-xs tabular"
                  style={{
                    left,
                    top: tooltipPos.y - 12,
                    width: TOOLTIP_W,
                    transform: 'translateY(-100%)',
                  }}
                >
                  <div className="font-medium mb-1">
                    {tooltipDateLabel(hoveredPoint.label, granularity)}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span className="text-white/60">Revenue</span>
                    <span className="text-right">{formatRupiah(hoveredPoint.total)}</span>
                    <span className="text-white/60">Orders</span>
                    <span className="text-right">{hoveredPoint.orders}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center">
            <div className="font-mono text-xs text-ink-tertiary uppercase">Total Revenue</div>
            <div className="text-2xl font-heading text-ink tabular mt-0.5">
              {formatRupiah(summary.totalRevenue)}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-ink-tertiary uppercase">Total Orders</div>
            <div className="text-2xl font-heading text-ink tabular mt-0.5">
              {summary.totalOrders}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-ink-tertiary uppercase">Avg Daily</div>
            <div className="text-2xl font-heading text-ink tabular mt-0.5">
              {formatRupiah(summary.avgDailyRevenue)}
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs text-ink-tertiary uppercase">Peak</div>
            <div className="text-2xl font-heading text-ink tabular mt-0.5">
              {summary.peak && summary.peak.total > 0
                ? `${tooltipDateLabel(summary.peak.label, granularity)}, ${formatRupiah(summary.peak.total)}`
                : '—'}
            </div>
          </div>
        </div>
      )}

      {/* Accessible tabular fallback for screen readers — sighted users see nothing. */}
      {points && points.length > 0 && (
        <table className="sr-only">
          <caption>{`Sales over time (${granularity})`}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Revenue</th>
              <th scope="col">Orders</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td>{tooltipDateLabel(p.label, granularity)}</td>
                <td>{formatRupiah(p.total)}</td>
                <td>{p.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
