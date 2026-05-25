import { Router } from 'express';
import { listProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js';
import {
  listIngredients,
  createIngredient,
  updateIngredientStock,
  deleteIngredient,
} from '../controllers/ingredientController.js';
import { getOrders, postOrder, deleteOrder } from '../controllers/orderController.js';
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';

const router = Router();

router.get('/products', listProducts);
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

router.get('/ingredients', listIngredients);
router.post('/ingredients', createIngredient);
router.patch('/ingredients/:id', updateIngredientStock);
router.delete('/ingredients/:id', deleteIngredient);

router.get('/orders', getOrders);
router.post('/orders', postOrder);
router.delete('/orders/:id', deleteOrder);

router.get('/expenses', listExpenses);
router.post('/expenses', createExpense);
router.patch('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

// --- Reports ---
import { prisma } from '../prisma.js';
import ExcelJS from 'exceljs';

// ── WIB timezone helpers ──
// All user-facing dates are WIB (UTC+7). Orders are stored in UTC.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function todayWibStr() {
  const nowWib = new Date(Date.now() + WIB_OFFSET_MS);
  return nowWib.toISOString().slice(0, 10);
}

function startOfWibMonthStr() {
  return todayWibStr().slice(0, 7) + '-01';
}

function toWibDateString(utcDate) {
  const wibMs = utcDate.getTime() + WIB_OFFSET_MS;
  return new Date(wibMs).toISOString().slice(0, 10);
}

// Returns the WIB-local Monday for a given WIB date string (YYYY-MM-DD)
function wibWeekStart(wibDateStr) {
  // Treat as midnight UTC for arithmetic, then shift back
  const d = new Date(wibDateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(fromStr, toStr) {
  const from = new Date(fromStr + 'T00:00:00Z');
  const to = new Date(toStr + 'T00:00:00Z');
  return Math.floor((to - from) / (24 * 60 * 60 * 1000)) + 1;
}

function parseRangeOrDefault(fromParam, toParam) {
  const validFmt = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  let from = fromParam;
  let to = toParam;

  if (!from && !to) {
    from = startOfWibMonthStr();
    to = todayWibStr();
  } else if (!from || !to) {
    throw Object.assign(new Error('Both "from" and "to" required, or neither.'), { status: 400 });
  }

  if (!validFmt(from) || !validFmt(to)) {
    throw Object.assign(new Error('Invalid date format. Use YYYY-MM-DD.'), { status: 400 });
  }

  if (from > to) [from, to] = [to, from];

  const startUtc = new Date(from + 'T00:00:00+07:00');
  const endUtc = new Date(to + 'T23:59:59.999+07:00');
  return { from, to, startUtc, endUtc };
}

// Returns the WIB date of the earliest order (for "All Time" preset).
router.get('/reports/earliest-order', async (_req, res) => {
  try {
    const oldest = await prisma.order.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (!oldest) return res.json({ date: null });
    res.json({ date: toWibDateString(oldest.createdAt) });
  } catch (err) {
    console.error('Earliest order error:', err);
    res.status(500).json({ error: 'Failed to fetch earliest order' });
  }
});

router.get('/reports/monthly-sales', async (req, res) => {
  try {
    const { from, to, startUtc, endUtc } = parseRangeOrDefault(req.query.from, req.query.to);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: startUtc, lte: endUtc } },
      select: { total: true, createdAt: true },
    });

    const daysCount = daysBetweenInclusive(from, to);
    const granularity = daysCount > 60 ? 'weekly' : 'daily';

    // Build buckets keyed by ISO date string (daily) or week-start date (weekly)
    const buckets = new Map();

    if (granularity === 'daily') {
      const cur = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        buckets.set(key, { key, label: key, total: 0, orders: 0 });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      for (const o of orders) {
        const key = toWibDateString(o.createdAt);
        const b = buckets.get(key);
        if (b) {
          b.total += Number(o.total);
          b.orders += 1;
        }
      }
    } else {
      // Weekly: bucket by WIB week-start (Monday)
      const cur = new Date(wibWeekStart(from) + 'T00:00:00Z');
      const end = new Date(wibWeekStart(to) + 'T00:00:00Z');
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        buckets.set(key, { key, label: key, total: 0, orders: 0 });
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
      for (const o of orders) {
        const key = wibWeekStart(toWibDateString(o.createdAt));
        const b = buckets.get(key);
        if (b) {
          b.total += Number(o.total);
          b.orders += 1;
        }
      }
    }

    const points = Array.from(buckets.values());
    const totalRevenue = points.reduce((s, p) => s + p.total, 0);
    const totalOrders = points.reduce((s, p) => s + p.orders, 0);
    const avgDailyRevenue = daysCount > 0 ? Math.round(totalRevenue / daysCount) : 0;
    const peakPoint = totalOrders > 0
      ? points.reduce((peak, p) => (p.total > peak.total ? p : peak), points[0])
      : null;

    res.json({
      from,
      to,
      granularity,
      points,
      summary: {
        totalRevenue,
        totalOrders,
        avgDailyRevenue,
        peak: peakPoint ? { label: peakPoint.label, total: peakPoint.total } : null,
      },
    });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('Monthly sales report error:', err);
    res.status(500).json({ error: 'Failed to generate monthly sales report' });
  }
});

// --- Export report as XLSX ---
//
// Four sheets:
//   1. Summary           — P&L waterfall + KPIs + Top-5 sections (entry sheet)
//   2. Orders            — every line item, full audit detail
//   3. Ingredient Usage  — per-ingredient breakdown
//   4. Expenses          — by-category summary, then chronological journal
//
// Visual treatment intentionally conservative: Calibri throughout, dark charcoal
// section headers, warm gold accent ONLY on Net Profit and the Crema header label.
// Accounting convention: parenthesized subtractions, single-rule under section totals,
// double-rule under Net Profit. See DECISIONS.md "XLSX reframe" entry for rationale.
router.get('/reports/export', async (req, res) => {
  try {
    const { from, to, startUtc, endUtc } = parseRangeOrDefault(req.query.from, req.query.to);

    const [orders, ingredients, expenses] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startUtc, lte: endUtc } },
        orderBy: { createdAt: 'asc' },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, recipes: { include: { ingredient: true } } },
              },
            },
          },
        },
      }),
      prisma.ingredient.findMany(),
      prisma.expenseEntry.findMany({
        where: { date: { gte: startUtc, lte: endUtc } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const ingMap = {};
    ingredients.forEach((ing) => {
      ingMap[ing.id] = { name: ing.name, unit: ing.unit, costPerUnit: Number(ing.costPerUnit || 0) };
    });

    // Aggregate orders → products / ingredients
    let totalRevenue = 0;
    let totalCost = 0;
    const productAgg = {};
    const ingredientAgg = {};

    orders.forEach((order) => {
      totalRevenue += Number(order.total);
      order.items.forEach((item) => {
        const pid = item.productId;
        const qty = item.quantity;
        const lineRevenue = Number(item.unitPrice) * qty;
        const lineCost = item.ingredientCost != null ? Number(item.ingredientCost) : 0;

        if (!productAgg[pid]) productAgg[pid] = { name: item.product.name, quantity: 0, revenue: 0, cost: 0 };
        productAgg[pid].quantity += qty;
        productAgg[pid].revenue += lineRevenue;
        productAgg[pid].cost += lineCost;

        (item.product.recipes || []).forEach((r) => {
          const ingId = r.ingredientId;
          if (!ingredientAgg[ingId]) ingredientAgg[ingId] = { used: 0 };
          ingredientAgg[ingId].used += Number(r.quantityRequired) * qty;
        });
      });
    });

    Object.values(productAgg).forEach((p) => { totalCost += p.cost; });

    // Aggregate expenses → by-category
    const expenseAgg = {};
    let totalExpenses = 0;
    expenses.forEach((e) => {
      const amt = Number(e.amount);
      totalExpenses += amt;
      if (!expenseAgg[e.category]) expenseAgg[e.category] = { entries: 0, total: 0 };
      expenseAgg[e.category].entries += 1;
      expenseAgg[e.category].total += amt;
    });

    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const totalInvestment = totalCost + totalExpenses;
    const roiPct = totalInvestment > 0 ? (netProfit / totalInvestment) : 0;

    // Build workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Crema';
    wb.created = new Date();

    // ── Shared style tokens ──
    const FONT = 'Calibri';
    const COLOR_INK = 'FF0F172A';        // deep charcoal
    const COLOR_MUTED = 'FF64748B';      // slate-500
    const COLOR_HAIRLINE = 'FFCBD5E1';   // slate-300
    const COLOR_GOLD = 'FFB45309';       // amber-700 — Net Profit accent
    const COLOR_RED = 'FFDC2626';        // negative net profit
    const COLOR_HEADER_FILL = 'FF0F172A';
    const COLOR_HEADER_TEXT = 'FFFFFFFF';
    const COLOR_ZEBRA = 'FFF8FAFC';      // very pale stripe

    const FMT_RP_POS = '"Rp "#,##0';
    const FMT_RP_NEG = '"Rp "#,##0;"Rp "(#,##0)';  // parens on negatives (accounting style)
    const FMT_PCT = '0.0%';

    function styleHeaderRow(row) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_FILL } };
        cell.font = { name: FONT, bold: true, color: { argb: COLOR_HEADER_TEXT }, size: 10 };
        cell.alignment = { vertical: 'middle' };
      });
      row.height = 22;
    }

    // Zebra stripe across an explicit column range — keeps the band continuous
    // through empty cells (row.eachCell skips unset cells).
    function zebraFill(row, cols) {
      for (let c = 1; c <= cols; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } };
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // Sheet 1 — Summary (P&L waterfall, Calibri, accounting convention)
    // ════════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Summary', {
      views: [{ showGridLines: false }],
      properties: { defaultRowHeight: 16 },
    });
    ws1.columns = [
      { width: 36 }, // A — labels
      { width: 14 }, // B — qty / secondary
      { width: 18 }, // C — amount
      { width: 12 }, // D — share / pct
    ];

    // Header strip
    const h1 = ws1.addRow(['CREMA']);
    ws1.mergeCells('A1:D1');
    h1.getCell(1).font = { name: FONT, bold: true, size: 22, color: { argb: COLOR_GOLD } };
    h1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    h1.height = 36;

    const h2 = ws1.addRow(['Financial Summary']);
    ws1.mergeCells('A2:D2');
    h2.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: COLOR_INK } };
    h2.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const h3 = ws1.addRow([`${from}  →  ${to}`]);
    ws1.mergeCells('A3:D3');
    h3.getCell(1).font = { name: FONT, italic: true, size: 10, color: { argb: COLOR_MUTED } };
    h3.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    h3.height = 18;

    // Heavy underline below the masthead
    const underlineRow = ws1.addRow([]);
    for (let c = 1; c <= 4; c++) {
      underlineRow.getCell(c).border = { bottom: { style: 'medium', color: { argb: COLOR_INK } } };
    }
    underlineRow.height = 4;

    ws1.addRow([]);

    if (orders.length === 0 && expenses.length === 0) {
      const empty = ws1.addRow(['No activity in this range.']);
      empty.getCell(1).font = { name: FONT, italic: true, color: { argb: COLOR_MUTED } };
    } else {
      // ── P&L waterfall ──
      const labelFont = { name: FONT, size: 10, color: { argb: COLOR_INK } };
      const labelFontIndent = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
      const numFont = { name: FONT, size: 11, color: { argb: COLOR_INK } };
      const numFontBold = { name: FONT, bold: true, size: 11, color: { argb: COLOR_INK } };

      function placeAmount(row, value, fmt, font) {
        const cell = row.getCell(3);
        cell.value = value;
        cell.numFmt = fmt;
        cell.font = font;
        cell.alignment = { horizontal: 'right' };
      }

      // REVENUE
      const rRev = ws1.addRow(['REVENUE']);
      rRev.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: COLOR_INK } };
      placeAmount(rRev, totalRevenue, FMT_RP_POS, numFontBold);

      // Less: Ingredient cost
      const rIng = ws1.addRow(['    Less: Ingredient cost']);
      rIng.getCell(1).font = labelFontIndent;
      placeAmount(rIng, -totalCost, FMT_RP_NEG, numFont);

      // Top-rule before Gross Profit
      const rule1 = ws1.addRow([]);
      for (let c = 1; c <= 4; c++) {
        rule1.getCell(c).border = { top: { style: 'thin', color: { argb: COLOR_HAIRLINE } } };
      }
      rule1.height = 4;

      // GROSS PROFIT
      const rGross = ws1.addRow(['GROSS PROFIT']);
      rGross.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: COLOR_INK } };
      placeAmount(rGross, grossProfit, FMT_RP_NEG, numFontBold);

      // Less: Operating expenses
      const rExp = ws1.addRow(['    Less: Operating expenses']);
      rExp.getCell(1).font = labelFontIndent;
      placeAmount(rExp, -totalExpenses, FMT_RP_NEG, numFont);

      // Top-rule before Net Profit
      const rule2 = ws1.addRow([]);
      for (let c = 1; c <= 4; c++) {
        rule2.getCell(c).border = { top: { style: 'thin', color: { argb: COLOR_HAIRLINE } } };
      }
      rule2.height = 4;

      // NET PROFIT — gold (or red if negative), bold, double bottom-rule
      const netColor = netProfit >= 0 ? COLOR_GOLD : COLOR_RED;
      const rNet = ws1.addRow(['NET PROFIT']);
      rNet.getCell(1).font = { name: FONT, bold: true, size: 12, color: { argb: netColor } };
      const netCell = rNet.getCell(3);
      netCell.value = netProfit;
      netCell.numFmt = FMT_RP_NEG;
      netCell.font = { name: FONT, bold: true, size: 12, color: { argb: netColor } };
      netCell.alignment = { horizontal: 'right' };
      rNet.height = 22;
      // Double bottom border under NET PROFIT label + amount
      [1, 3].forEach((c) => {
        rNet.getCell(c).border = {
          top: { style: 'thin', color: { argb: COLOR_INK } },
          bottom: { style: 'double', color: { argb: COLOR_INK } },
        };
      });

      ws1.addRow([]);

      // Secondary KPIs — Orders + ROI on a single row
      const rKpi = ws1.addRow(['Orders placed', null, 'Return on investment']);
      rKpi.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
      rKpi.getCell(3).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
      rKpi.getCell(3).alignment = { horizontal: 'right' };

      const rKpiV = ws1.addRow([orders.length, null, totalInvestment > 0 ? roiPct : null]);
      rKpiV.getCell(1).font = { name: FONT, bold: true, size: 14, color: { argb: COLOR_INK } };
      const roiCell = rKpiV.getCell(3);
      if (totalInvestment > 0) {
        roiCell.numFmt = FMT_PCT;
      } else {
        roiCell.value = '—';
      }
      roiCell.font = { name: FONT, bold: true, size: 14, color: { argb: roiPct >= 0 ? COLOR_INK : COLOR_RED } };
      roiCell.alignment = { horizontal: 'right' };
      rKpiV.height = 22;

      ws1.addRow([]);
      ws1.addRow([]);

      // ── Top 5 Products ──
      const productList = Object.values(productAgg)
        .map((p) => ({ ...p, share: totalRevenue > 0 ? p.revenue / totalRevenue : 0 }))
        .sort((a, b) => b.revenue - a.revenue);
      const top5Products = productList.slice(0, 5);

      const secProducts = ws1.addRow(['TOP 5 PRODUCTS (by revenue)']);
      ws1.mergeCells(`A${secProducts.number}:D${secProducts.number}`);
      secProducts.getCell(1).font = { name: FONT, bold: true, size: 10, color: { argb: COLOR_INK } };
      [1, 2, 3, 4].forEach((c) => {
        secProducts.getCell(c).border = { bottom: { style: 'thin', color: { argb: COLOR_INK } } };
      });

      const pHeader = ws1.addRow(['Product', 'Qty', 'Revenue', 'Share']);
      pHeader.getCell(2).alignment = { horizontal: 'right' };
      pHeader.getCell(3).alignment = { horizontal: 'right' };
      pHeader.getCell(4).alignment = { horizontal: 'right' };
      pHeader.eachCell((cell) => {
        cell.font = { name: FONT, size: 9, color: { argb: COLOR_MUTED } };
      });

      let prodZebra = false;
      top5Products.forEach((p) => {
        const r = ws1.addRow([p.name, p.quantity, p.revenue, p.share]);
        r.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        r.getCell(2).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        r.getCell(2).alignment = { horizontal: 'right' };
        r.getCell(3).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        r.getCell(3).numFmt = FMT_RP_POS;
        r.getCell(3).alignment = { horizontal: 'right' };
        r.getCell(4).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
        r.getCell(4).numFmt = FMT_PCT;
        r.getCell(4).alignment = { horizontal: 'right' };
        if (prodZebra) zebraFill(r, 4);
        prodZebra = !prodZebra;
      });
      if (productList.length > 5) {
        const more = ws1.addRow([`+ ${productList.length - 5} more — see Orders tab for full detail →`]);
        ws1.mergeCells(`A${more.number}:D${more.number}`);
        more.getCell(1).font = { name: FONT, italic: true, size: 9, color: { argb: COLOR_MUTED } };
      }

      ws1.addRow([]);
      ws1.addRow([]);

      // ── Top 5 Expense Categories ──
      const expenseList = Object.entries(expenseAgg)
        .map(([cat, v]) => ({
          name: cat,
          entries: v.entries,
          total: v.total,
          share: totalExpenses > 0 ? v.total / totalExpenses : 0,
        }))
        .sort((a, b) => b.total - a.total);
      const top5Expenses = expenseList.slice(0, 5);

      const secExp = ws1.addRow(['TOP 5 EXPENSE CATEGORIES']);
      ws1.mergeCells(`A${secExp.number}:D${secExp.number}`);
      secExp.getCell(1).font = { name: FONT, bold: true, size: 10, color: { argb: COLOR_INK } };
      [1, 2, 3, 4].forEach((c) => {
        secExp.getCell(c).border = { bottom: { style: 'thin', color: { argb: COLOR_INK } } };
      });

      const eHeader = ws1.addRow(['Category', 'Entries', 'Amount', 'Share']);
      eHeader.getCell(2).alignment = { horizontal: 'right' };
      eHeader.getCell(3).alignment = { horizontal: 'right' };
      eHeader.getCell(4).alignment = { horizontal: 'right' };
      eHeader.eachCell((cell) => {
        cell.font = { name: FONT, size: 9, color: { argb: COLOR_MUTED } };
      });

      if (top5Expenses.length === 0) {
        const none = ws1.addRow(['No expenses logged in this range.']);
        ws1.mergeCells(`A${none.number}:D${none.number}`);
        none.getCell(1).font = { name: FONT, italic: true, size: 10, color: { argb: COLOR_MUTED } };
      } else {
        let expCatZebra = false;
        top5Expenses.forEach((e) => {
          const r = ws1.addRow([e.name, e.entries, e.total, e.share]);
          r.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
          r.getCell(2).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
          r.getCell(2).alignment = { horizontal: 'right' };
          r.getCell(3).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
          r.getCell(3).numFmt = FMT_RP_POS;
          r.getCell(3).alignment = { horizontal: 'right' };
          r.getCell(4).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
          r.getCell(4).numFmt = FMT_PCT;
          r.getCell(4).alignment = { horizontal: 'right' };
          if (expCatZebra) zebraFill(r, 4);
          expCatZebra = !expCatZebra;
        });
        if (expenseList.length > 5) {
          const more = ws1.addRow([`+ ${expenseList.length - 5} more — see Expenses tab for full journal →`]);
          ws1.mergeCells(`A${more.number}:D${more.number}`);
          more.getCell(1).font = { name: FONT, italic: true, size: 9, color: { argb: COLOR_MUTED } };
        }
      }

      ws1.addRow([]);
      ws1.addRow([]);

      // ── Top 5 Ingredients by cost ──
      const ingredientList = Object.entries(ingredientAgg)
        .map(([id, data]) => {
          const ing = ingMap[id];
          if (!ing) return null;
          return { name: ing.name, unit: ing.unit, used: data.used, costPerUnit: ing.costPerUnit, totalCost: data.used * ing.costPerUnit };
        })
        .filter(Boolean)
        .sort((a, b) => b.totalCost - a.totalCost);
      const top5Ingredients = ingredientList.slice(0, 5);

      const secIng = ws1.addRow(['TOP 5 INGREDIENTS (by cost)']);
      ws1.mergeCells(`A${secIng.number}:D${secIng.number}`);
      secIng.getCell(1).font = { name: FONT, bold: true, size: 10, color: { argb: COLOR_INK } };
      [1, 2, 3, 4].forEach((c) => {
        secIng.getCell(c).border = { bottom: { style: 'thin', color: { argb: COLOR_INK } } };
      });

      const iHeader = ws1.addRow(['Ingredient', 'Used', 'Cost/unit', 'Total cost']);
      iHeader.getCell(2).alignment = { horizontal: 'right' };
      iHeader.getCell(3).alignment = { horizontal: 'right' };
      iHeader.getCell(4).alignment = { horizontal: 'right' };
      iHeader.eachCell((cell) => {
        cell.font = { name: FONT, size: 9, color: { argb: COLOR_MUTED } };
      });

      if (top5Ingredients.length === 0) {
        const none = ws1.addRow(['No ingredient usage in this range.']);
        ws1.mergeCells(`A${none.number}:D${none.number}`);
        none.getCell(1).font = { name: FONT, italic: true, size: 10, color: { argb: COLOR_MUTED } };
      } else {
        let topIngZebra = false;
        top5Ingredients.forEach((ing) => {
          const r = ws1.addRow([ing.name, `${ing.used} ${ing.unit}`, ing.costPerUnit, ing.totalCost]);
          r.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
          r.getCell(2).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
          r.getCell(2).alignment = { horizontal: 'right' };
          r.getCell(3).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
          r.getCell(3).numFmt = FMT_RP_POS;
          r.getCell(3).alignment = { horizontal: 'right' };
          r.getCell(4).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
          r.getCell(4).numFmt = FMT_RP_POS;
          r.getCell(4).alignment = { horizontal: 'right' };
          if (topIngZebra) zebraFill(r, 4);
          topIngZebra = !topIngZebra;
        });
        if (ingredientList.length > 5) {
          const more = ws1.addRow([`+ ${ingredientList.length - 5} more — see Ingredient Usage tab for full breakdown →`]);
          ws1.mergeCells(`A${more.number}:D${more.number}`);
          more.getCell(1).font = { name: FONT, italic: true, size: 9, color: { argb: COLOR_MUTED } };
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // Sheet 2 — Orders (every line item, full audit detail)
    // ════════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Orders', { views: [{ showGridLines: false }] });
    ws2.columns = [
      { width: 10 }, { width: 18 }, { width: 22 }, { width: 8 },
      { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 },
    ];
    const orderHeaderRow = ws2.addRow(['Order ID', 'Date', 'Product', 'Qty', 'Unit Price', 'Line Total', 'Ingredient Cost', 'Line Profit']);
    styleHeaderRow(orderHeaderRow);
    [4, 5, 6, 7, 8].forEach((c) => { orderHeaderRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'right' }; });

    let zebra = false;
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const lineTotal = Number(item.unitPrice) * item.quantity;
        const ingCost = item.ingredientCost != null ? Number(item.ingredientCost) : 0;
        const row = ws2.addRow([
          order.id,
          order.createdAt.toISOString().slice(0, 16).replace('T', ' '),
          item.product.name,
          item.quantity,
          Number(item.unitPrice),
          lineTotal,
          ingCost,
          lineTotal - ingCost,
        ]);
        row.eachCell((cell) => { cell.font = { name: FONT, size: 10, color: { argb: COLOR_INK } }; });
        [4, 5, 6, 7, 8].forEach((c) => { row.getCell(c).alignment = { horizontal: 'right' }; });
        [5, 6, 7, 8].forEach((c) => { row.getCell(c).numFmt = FMT_RP_POS; });
        if (zebra) zebraFill(row, 8);
        zebra = !zebra;
      });
    });

    // ════════════════════════════════════════════════════════════════════
    // Sheet 3 — Ingredient Usage (full breakdown by total cost)
    // ════════════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Ingredient Usage', { views: [{ showGridLines: false }] });
    ws3.columns = [{ width: 22 }, { width: 8 }, { width: 16 }, { width: 14 }, { width: 16 }];
    const ingHeaderRow = ws3.addRow(['Ingredient', 'Unit', 'Total Used', 'Cost/Unit', 'Total Cost']);
    styleHeaderRow(ingHeaderRow);
    [3, 4, 5].forEach((c) => { ingHeaderRow.getCell(c).alignment = { vertical: 'middle', horizontal: 'right' }; });

    let ingTotalCost = 0;
    const sortedIngredients = Object.entries(ingredientAgg)
      .map(([id, data]) => {
        const ing = ingMap[id];
        if (!ing) return null;
        const cost = data.used * ing.costPerUnit;
        ingTotalCost += cost;
        return { name: ing.name, unit: ing.unit, used: data.used, costPerUnit: ing.costPerUnit, totalCost: cost };
      })
      .filter(Boolean)
      .sort((a, b) => b.totalCost - a.totalCost);

    let ingZebra = false;
    sortedIngredients.forEach((ing) => {
      const row = ws3.addRow([ing.name, ing.unit, ing.used, ing.costPerUnit, ing.totalCost]);
      row.eachCell((cell) => { cell.font = { name: FONT, size: 10, color: { argb: COLOR_INK } }; });
      [3, 4, 5].forEach((c) => { row.getCell(c).alignment = { horizontal: 'right' }; });
      row.getCell(4).numFmt = FMT_RP_POS;
      row.getCell(5).numFmt = FMT_RP_POS;
      if (ingZebra) zebraFill(row, 5);
      ingZebra = !ingZebra;
    });

    if (sortedIngredients.length > 0) {
      const totalRow = ws3.addRow(['Total', '', '', '', ingTotalCost]);
      totalRow.eachCell((cell) => {
        cell.font = { name: FONT, bold: true, size: 10, color: { argb: COLOR_INK } };
        cell.border = { top: { style: 'thin', color: { argb: COLOR_INK } } };
      });
      totalRow.getCell(5).alignment = { horizontal: 'right' };
      totalRow.getCell(5).numFmt = FMT_RP_POS;
    }

    // ════════════════════════════════════════════════════════════════════
    // Sheet 4 — Expenses (category summary first, then chronological journal)
    // ════════════════════════════════════════════════════════════════════
    const ws4 = wb.addWorksheet('Expenses', { views: [{ showGridLines: false }] });
    ws4.columns = [{ width: 16 }, { width: 18 }, { width: 10 }, { width: 16 }, { width: 36 }];

    // ── By-category summary ──
    const sec1 = ws4.addRow(['BY CATEGORY']);
    ws4.mergeCells(`A1:E1`);
    sec1.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: COLOR_INK } };
    [1, 2, 3, 4, 5].forEach((c) => {
      sec1.getCell(c).border = { bottom: { style: 'medium', color: { argb: COLOR_INK } } };
    });
    sec1.height = 22;

    const catHeader = ws4.addRow(['Category', '', 'Entries', 'Total', '']);
    catHeader.getCell(3).alignment = { horizontal: 'right' };
    catHeader.getCell(4).alignment = { horizontal: 'right' };
    catHeader.eachCell((cell) => {
      cell.font = { name: FONT, size: 9, color: { argb: COLOR_MUTED } };
    });

    const sortedExpenseCats = Object.entries(expenseAgg)
      .map(([cat, v]) => ({ name: cat, entries: v.entries, total: v.total }))
      .sort((a, b) => b.total - a.total);

    if (sortedExpenseCats.length === 0) {
      const none = ws4.addRow(['No expenses logged in this range.']);
      ws4.mergeCells(`A${none.number}:E${none.number}`);
      none.getCell(1).font = { name: FONT, italic: true, color: { argb: COLOR_MUTED } };
    } else {
      let catZebra = false;
      sortedExpenseCats.forEach((c) => {
        const row = ws4.addRow([c.name, '', c.entries, c.total, '']);
        row.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        row.getCell(3).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        row.getCell(3).alignment = { horizontal: 'right' };
        row.getCell(4).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        row.getCell(4).numFmt = FMT_RP_POS;
        row.getCell(4).alignment = { horizontal: 'right' };
        if (catZebra) zebraFill(row, 5);
        catZebra = !catZebra;
      });
      const catTotal = ws4.addRow(['Total', '', expenses.length, totalExpenses, '']);
      catTotal.eachCell((cell) => {
        cell.font = { name: FONT, bold: true, size: 10, color: { argb: COLOR_INK } };
        cell.border = { top: { style: 'thin', color: { argb: COLOR_INK } } };
      });
      catTotal.getCell(3).alignment = { horizontal: 'right' };
      catTotal.getCell(4).alignment = { horizontal: 'right' };
      catTotal.getCell(4).numFmt = FMT_RP_POS;
    }

    ws4.addRow([]);
    ws4.addRow([]);

    // ── Chronological journal ──
    const sec2 = ws4.addRow(['JOURNAL (chronological)']);
    ws4.mergeCells(`A${sec2.number}:E${sec2.number}`);
    sec2.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: COLOR_INK } };
    [1, 2, 3, 4, 5].forEach((c) => {
      sec2.getCell(c).border = { bottom: { style: 'medium', color: { argb: COLOR_INK } } };
    });
    sec2.height = 22;

    const journalHeader = ws4.addRow(['Date', 'Category', '', 'Amount', 'Note']);
    journalHeader.getCell(4).alignment = { horizontal: 'right' };
    journalHeader.eachCell((cell) => {
      cell.font = { name: FONT, size: 9, color: { argb: COLOR_MUTED } };
    });

    if (expenses.length === 0) {
      // already handled above
    } else {
      let expZebra = false;
      expenses.forEach((e) => {
        const dateStr = e.date.toISOString().slice(0, 10);
        const row = ws4.addRow([dateStr, e.category, '', Number(e.amount), e.note || '']);
        row.getCell(1).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        row.getCell(2).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        row.getCell(4).font = { name: FONT, size: 10, color: { argb: COLOR_INK } };
        row.getCell(4).numFmt = FMT_RP_POS;
        row.getCell(4).alignment = { horizontal: 'right' };
        row.getCell(5).font = { name: FONT, size: 10, color: { argb: COLOR_MUTED } };
        if (expZebra) zebraFill(row, 5);
        expZebra = !expZebra;
      });
    }

    const filename = `report_${from}_to_${to}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// --- DEV ONLY ---

const isDev = process.env.NODE_ENV !== 'production';

function devGuard(req, res, next) {
  if (!isDev) return res.status(404).json({ error: 'Not found' });
  next();
}

async function wipeAll() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.product.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.expenseEntry.deleteMany();
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Product_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Ingredient_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Recipe_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "Order_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "OrderItem_id_seq" RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "ExpenseEntry_id_seq" RESTART WITH 1`);
}

// Basic seed (PRD spec — 3 ingredients, 3 products)
const BASIC_INGREDIENTS = [
  { name: 'Coffee Beans', unit: 'g', stockQuantity: 1000, costPerUnit: 150, lowStockThreshold: 200 },
  { name: 'Milk', unit: 'ml', stockQuantity: 2000, costPerUnit: 30, lowStockThreshold: 500 },
  { name: 'Cup', unit: 'pcs', stockQuantity: 50, costPerUnit: 500, lowStockThreshold: 10 },
];

const BASIC_PRODUCTS = [
  { name: 'Espresso', price: 25000, recipe: [['Coffee Beans', 20], ['Cup', 1]] },
  { name: 'Latte', price: 35000, recipe: [['Coffee Beans', 20], ['Milk', 150], ['Cup', 1]] },
  { name: 'Cappuccino', price: 32000, recipe: [['Coffee Beans', 20], ['Milk', 100], ['Cup', 1]] },
];

// Full seed (stress-test menu — ~10 ingredients, ~15 products)
const FULL_INGREDIENTS = [
  { name: 'Coffee Beans', unit: 'g', stockQuantity: 5000, costPerUnit: 150, lowStockThreshold: 500 },
  { name: 'Milk', unit: 'ml', stockQuantity: 10000, costPerUnit: 30, lowStockThreshold: 1500 },
  { name: 'Cup', unit: 'pcs', stockQuantity: 200, costPerUnit: 500, lowStockThreshold: 30 },
  { name: 'Matcha Powder', unit: 'g', stockQuantity: 500, costPerUnit: 800, lowStockThreshold: 80 },
  { name: 'Chocolate Powder', unit: 'g', stockQuantity: 800, costPerUnit: 400, lowStockThreshold: 100 },
  { name: 'Vanilla Syrup', unit: 'ml', stockQuantity: 1000, costPerUnit: 120, lowStockThreshold: 150 },
  { name: 'Ice', unit: 'g', stockQuantity: 8000, costPerUnit: 5, lowStockThreshold: 1000 },
  { name: 'Bread', unit: 'pcs', stockQuantity: 60, costPerUnit: 3500, lowStockThreshold: 10 },
  { name: 'Butter', unit: 'g', stockQuantity: 500, costPerUnit: 200, lowStockThreshold: 80 },
  { name: 'Cheese', unit: 'g', stockQuantity: 600, costPerUnit: 350, lowStockThreshold: 100 },
];

const FULL_PRODUCTS = [
  { name: 'Espresso', price: 25000, recipe: [['Coffee Beans', 20], ['Cup', 1]] },
  { name: 'Americano', price: 27000, recipe: [['Coffee Beans', 20], ['Cup', 1]] },
  { name: 'Latte', price: 35000, recipe: [['Coffee Beans', 20], ['Milk', 150], ['Cup', 1]] },
  { name: 'Cappuccino', price: 32000, recipe: [['Coffee Beans', 20], ['Milk', 100], ['Cup', 1]] },
  { name: 'Flat White', price: 33000, recipe: [['Coffee Beans', 22], ['Milk', 120], ['Cup', 1]] },
  { name: 'Macchiato', price: 30000, recipe: [['Coffee Beans', 20], ['Milk', 30], ['Cup', 1]] },
  { name: 'Vanilla Latte', price: 38000, recipe: [['Coffee Beans', 20], ['Milk', 150], ['Vanilla Syrup', 15], ['Cup', 1]] },
  { name: 'Mocha', price: 40000, recipe: [['Coffee Beans', 20], ['Milk', 130], ['Chocolate Powder', 15], ['Cup', 1]] },
  { name: 'Iced Latte', price: 36000, recipe: [['Coffee Beans', 20], ['Milk', 120], ['Ice', 80], ['Cup', 1]] },
  { name: 'Iced Americano', price: 28000, recipe: [['Coffee Beans', 20], ['Ice', 80], ['Cup', 1]] },
  { name: 'Matcha Latte', price: 42000, recipe: [['Matcha Powder', 8], ['Milk', 150], ['Cup', 1]] },
  { name: 'Hot Chocolate', price: 35000, recipe: [['Chocolate Powder', 25], ['Milk', 180], ['Cup', 1]] },
  { name: 'Croissant', price: 22000, recipe: [['Bread', 1], ['Butter', 15]] },
  { name: 'Cheese Toast', price: 28000, recipe: [['Bread', 2], ['Butter', 10], ['Cheese', 40]] },
  { name: 'Plain Water', price: 8000, recipe: [] },
];

async function seedFixture(ingredients, products) {
  await wipeAll();
  const ingMap = {};
  for (const ing of ingredients) {
    const created = await prisma.ingredient.create({ data: ing });
    ingMap[ing.name] = created.id;
  }
  for (const prod of products) {
    await prisma.product.create({
      data: {
        name: prod.name,
        price: prod.price,
        recipes: {
          create: prod.recipe.map(([ingName, qty]) => ({
            ingredientId: ingMap[ingName],
            quantityRequired: qty,
          })),
        },
      },
    });
  }
}

router.delete('/dev/reset', devGuard, async (_req, res) => {
  try {
    await wipeAll();
    res.json({ message: 'All data reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

router.post('/dev/seed', devGuard, async (_req, res) => {
  try {
    await seedFixture(BASIC_INGREDIENTS, BASIC_PRODUCTS);
    res.json({ message: 'Basic seed loaded (3 ingredients, 3 products)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Seed failed' });
  }
});

router.post('/dev/seed-full', devGuard, async (_req, res) => {
  try {
    await seedFixture(FULL_INGREDIENTS, FULL_PRODUCTS);
    res.json({ message: `Full seed loaded (${FULL_INGREDIENTS.length} ingredients, ${FULL_PRODUCTS.length} products)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Seed full failed' });
  }
});

router.post('/dev/drain-stock', devGuard, async (_req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany();
    for (const ing of ingredients) {
      const target = Math.max(0, Math.round(Number(ing.lowStockThreshold) * 1.05));
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: { stockQuantity: target },
      });
    }
    res.json({ message: `Drained stock for ${ingredients.length} ingredients to threshold + 5%` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Drain stock failed' });
  }
});

router.post('/dev/refill-stock', devGuard, async (_req, res) => {
  try {
    // Restore to original seed quantities. Look up by name from both fixtures.
    const seedMap = {};
    [...BASIC_INGREDIENTS, ...FULL_INGREDIENTS].forEach((ing) => {
      seedMap[ing.name] = ing.stockQuantity;
    });

    const ingredients = await prisma.ingredient.findMany();
    let restored = 0;
    for (const ing of ingredients) {
      if (seedMap[ing.name] != null) {
        await prisma.ingredient.update({
          where: { id: ing.id },
          data: { stockQuantity: seedMap[ing.name] },
        });
        restored++;
      }
    }
    res.json({ message: `Refilled ${restored} ingredient(s) to seed quantities. Orders untouched.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Refill stock failed' });
  }
});

// --- DEV ONLY: fill a month with realistic random orders + expenses ---
// Generates one month's worth of operational data so demos and Reports have something
// to chew on. Tuned for a small/growing Indonesian café (home-based or small kios scale)
// — totals land around Rp 4M-10M/month in overhead, not big-shop budgets.
//
// Realism quirks baked in:
//   - amounts jittered to non-round figures (jitter5pct + nearest Rp 500)
//   - "stable" categories (Rent, Internet, Electricity, Water) sometimes skip (forgot to log)
//   - Salary often has 0 entries (owner-only scale)
//   - ~20% of Miscellaneous entries are freak large events (equipment repair, marketing)
//   - ~60% of entries get a note; remainder are unlabeled
function genExpensesForMonth(year, month, isCurrentMonth, lastDay) {
  const entries = [];
  const rand = Math.random;

  function jitter(min, max) {
    // Random in [min, max], snapped to nearest Rp 500 — feels like real bills, not seeded round numbers.
    const raw = min + rand() * (max - min);
    return Math.round(raw / 500) * 500;
  }
  function pickDay(minDay, maxDay) {
    const lo = Math.max(1, minDay);
    const hi = Math.min(lastDay, maxDay);
    if (hi < lo) return lo;
    return Math.floor(rand() * (hi - lo + 1)) + lo;
  }
  function dateAt(day) {
    // Use noon to dodge timezone edge cases on the WIB boundary; backend stores UTC and
    // the WIB filters in the rest of the app handle the offset.
    return new Date(year, month, day, 12, 0, 0);
  }
  function pickNote(options) {
    if (rand() < 0.4) return null; // ~40% unlabeled
    return options[Math.floor(rand() * options.length)];
  }
  function maybeSkip(p) { return rand() < p; }

  // Rent — 1×, day 1±2, 30% skip (home-based businesses often have no rent)
  if (!maybeSkip(0.3)) {
    entries.push({
      date: dateAt(pickDay(1, 3)),
      category: 'Rent',
      amount: jitter(1000000, 3000000),
      note: pickNote(['Sewa kios', 'Sewa bulan ini', 'Kontrak sewa']),
    });
  }

  // Internet — 1×, day 3-7, 10% skip
  if (!maybeSkip(0.1)) {
    entries.push({
      date: dateAt(pickDay(3, 7)),
      category: 'Internet',
      amount: jitter(200000, 400000),
      note: pickNote(['Indihome paket basic', 'Tagihan internet', 'Indihome']),
    });
  }

  // Electricity — 1×, day 5-15, 10% skip
  if (!maybeSkip(0.1)) {
    entries.push({
      date: dateAt(pickDay(5, 15)),
      category: 'Electricity',
      amount: jitter(200000, 600000),
      note: pickNote(['PLN bulan ini', 'Tagihan listrik', 'PLN']),
    });
  }

  // Water — 1×, day 5-15, 10% skip
  if (!maybeSkip(0.1)) {
    entries.push({
      date: dateAt(pickDay(5, 15)),
      category: 'Water',
      amount: jitter(50000, 150000),
      note: pickNote(['PDAM', 'Air bulan ini']),
    });
  }

  // Salary — 50% chance of 0 entries (owner-only scale). Otherwise 1-2 entries.
  if (!maybeSkip(0.5)) {
    const count = rand() < 0.5 ? 2 : 1;
    const names = ['Andi', 'Budi', 'Sari', 'Rina', 'Joko', 'Dewi'];
    const shuffled = [...names].sort(() => rand() - 0.5);
    for (let i = 0; i < count; i++) {
      entries.push({
        date: dateAt(rand() < 0.5 ? 1 : 15),
        category: 'Salary',
        amount: jitter(1500000, 3000000),
        note: pickNote([`Gaji ${shuffled[i]}`, `Gaji ${shuffled[i]} part-time`, 'Gaji karyawan']),
      });
    }
  }

  // Gas — 1-2 entries
  {
    const count = rand() < 0.5 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      entries.push({
        date: dateAt(pickDay(1, lastDay)),
        category: 'Gas',
        amount: jitter(150000, 200000),
        note: pickNote(['Refill tabung 12kg', 'LPG', 'Tabung gas']),
      });
    }
  }

  // Packaging — 1-2 entries
  {
    const count = rand() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      entries.push({
        date: dateAt(pickDay(1, lastDay)),
        category: 'Packaging',
        amount: jitter(150000, 500000),
        note: pickNote(['Cup 12oz + sedotan', 'Paper bag', 'Cup + lid', 'Stok cup', 'Tutup gelas']),
      });
    }
  }

  // Delivery — 3-6 entries
  {
    const count = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      entries.push({
        date: dateAt(pickDay(1, lastDay)),
        category: 'Delivery',
        amount: jitter(15000, 50000),
        note: pickNote(['Kirim biji kopi', 'Pengiriman susu UHT', 'Antar bahan', 'Ongkir supplier', 'Kirim cup']),
      });
    }
  }

  // Transport — 2-4 entries
  {
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      entries.push({
        date: dateAt(pickDay(1, lastDay)),
        category: 'Transport',
        amount: jitter(20000, 80000),
        note: pickNote(['Bensin motor', 'BBM delivery', 'Servis motor', 'Parkir + bensin', 'Ambil bahan ke pasar']),
      });
    }
  }

  // Misc — 0-3 entries; each has ~20% chance of being a freak large event
  {
    const count = Math.floor(rand() * 4);
    for (let i = 0; i < count; i++) {
      const isFreak = rand() < 0.2;
      entries.push({
        date: dateAt(pickDay(1, lastDay)),
        category: 'Miscellaneous',
        amount: isFreak ? jitter(500000, 1500000) : jitter(30000, 300000),
        note: pickNote(isFreak
          ? ['Repair grinder', 'Ganti blender', 'Servis mesin espresso', 'Marketing event']
          : ['Stiker logo', 'Tissue + lap', 'Tambal kursi', 'Sabun cuci', 'Korek + lilin']),
      });
    }
  }

  return entries;
}

router.post('/dev/fill-data', devGuard, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { recipes: { include: { ingredient: true } } },
    });

    if (products.length === 0) {
      return res.status(400).json({ error: 'No products found. Seed data first.' });
    }

    // Determine target month (default: current WIB month)
    let monthParam = req.query.month || req.body?.month;
    const now = new Date();
    let year, month;

    if (monthParam) {
      if (!/^\d{4}-\d{2}$/.test(monthParam)) {
        return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
      }
      const [y, m] = monthParam.split('-').map(Number);
      if (m < 1 || m > 12) {
        return res.status(400).json({ error: 'Month must be 01-12.' });
      }
      year = y;
      month = m - 1;
    } else {
      year = now.getFullYear();
      month = now.getMonth();
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // If target is current month, stop at today; otherwise fill the whole month
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const lastDay = isCurrentMonth ? Math.min(daysInMonth, now.getDate()) : daysInMonth;

    let totalOrders = 0;

    for (let day = 1; day <= lastDay; day++) {
      const date = new Date(year, month, day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const orderCount = Math.floor(Math.random() * (isWeekend ? 10 : 7)) + 3;

      for (let o = 0; o < orderCount; o++) {
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const shuffled = [...products].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, itemCount);

        const orderItems = picked.map((p) => {
          const qty = Math.floor(Math.random() * 3) + 1;
          let ingredientCost = 0;
          for (const recipe of p.recipes) {
            ingredientCost += Number(recipe.quantityRequired) * qty * Number(recipe.ingredient.costPerUnit || 0);
          }
          return {
            productId: p.id,
            quantity: qty,
            unitPrice: Number(p.price),
            ingredientCost,
          };
        });

        const total = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

        const hour = Math.floor(Math.random() * 14) + 7;
        const minute = Math.floor(Math.random() * 60);
        const createdAt = new Date(year, month, day, hour, minute);

        await prisma.order.create({
          data: { total, createdAt, items: { create: orderItems } },
        });
        totalOrders++;
      }
    }

    // Restock to keep things usable
    await prisma.ingredient.updateMany({ data: { stockQuantity: 99999 } });

    // Expense entries — generate after orders so dates land in the same month window.
    // Inserted as a batch with createMany since they have no relations.
    const expensePayload = genExpensesForMonth(year, month, isCurrentMonth, lastDay);
    if (expensePayload.length > 0) {
      await prisma.expenseEntry.createMany({ data: expensePayload });
    }

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    res.json({
      message: `Generated ${totalOrders} orders + ${expensePayload.length} expenses across ${lastDay} days in ${monthStr}. Ingredient stock restocked.`,
      month: monthStr,
      orderCount: totalOrders,
      expenseCount: expensePayload.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fill data failed' });
  }
});

export default router;
