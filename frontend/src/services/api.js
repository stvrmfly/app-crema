const BASE = 'http://localhost:3001';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function rangeQs(from, to) {
  if (!from || !to) return '';
  return `?from=${from}&to=${to}`;
}

export const api = {
  getProducts: () => request('GET', '/products'),
  createProduct: (payload) => request('POST', '/products', payload),
  updateProduct: (id, payload) => request('PATCH', `/products/${id}`, payload),
  deleteProduct: (id) => request('DELETE', `/products/${id}`),

  getIngredients: () => request('GET', '/ingredients'),
  createIngredient: (payload) => request('POST', '/ingredients', payload),
  updateIngredient: (id, data) => request('PATCH', `/ingredients/${id}`, data),
  deleteIngredient: (id) => request('DELETE', `/ingredients/${id}`),

  getOrders: (from, to) => request('GET', '/orders' + rangeQs(from, to)),
  createOrder: (items) => request('POST', '/orders', { items }),
  deleteOrder: (id) => request('DELETE', `/orders/${id}`),

  getExpenses: (from, to, category) => {
    const params = new URLSearchParams();
    if (from && to) { params.set('from', from); params.set('to', to); }
    if (category) params.set('category', category);
    const qs = params.toString();
    return request('GET', '/expenses' + (qs ? `?${qs}` : ''));
  },
  createExpense: (payload) => request('POST', '/expenses', payload),
  updateExpense: (id, payload) => request('PATCH', `/expenses/${id}`, payload),
  deleteExpense: (id) => request('DELETE', `/expenses/${id}`),

  getMonthlySales: (from, to) =>
    request('GET', '/reports/monthly-sales' + rangeQs(from, to)),

  getEarliestOrder: () => request('GET', '/reports/earliest-order'),

  exportReport: (from, to) => {
    const url = `${BASE}/reports/export?from=${from}&to=${to}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${from}_to_${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // Dev endpoints
  resetAll: () => request('DELETE', '/dev/reset'),
  seedBasic: () => request('POST', '/dev/seed'),
  seedFull: () => request('POST', '/dev/seed-full'),
  fillData: (month) => request('POST', `/dev/fill-data${month ? `?month=${month}` : ''}`),
  drainStock: () => request('POST', '/dev/drain-stock'),
  refillStock: () => request('POST', '/dev/refill-stock'),
};

export function formatRupiah(value) {
  const n = Number(value);
  return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

// Parses Indonesian shorthand: "25k" / "25rb" → 25000, "1.5jt" / "1.5m" → 1500000,
// "25.000" / "25,000" → 25000, plain "25000" → 25000. Returns null for empty input,
// NaN for malformed input.
export function parsePriceInput(str) {
  if (str == null) return null;
  const s = String(str).trim().toLowerCase();
  if (s === '') return null;
  // Strip thousand separators (period or comma when not followed by a single decimal).
  // Accept: 25, 25.5, 25,5, 25k, 25rb, 25.5k, 25.000, 25,000
  const m = s.match(/^(\d{1,3}(?:[.,]\d{3})*|\d+(?:[.,]\d+)?)\s*(k|rb|jt|m|)?$/);
  if (!m) return NaN;
  let [, num, suffix] = m;
  // If "25.000" or "25,000" pattern (thousands separator), strip the separators.
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) {
    num = num.replace(/[.,]/g, '');
  } else {
    // Otherwise treat the separator as a decimal point.
    num = num.replace(',', '.');
  }
  const n = Number(num);
  if (Number.isNaN(n)) return NaN;
  if (suffix === 'k' || suffix === 'rb') return n * 1000;
  if (suffix === 'jt' || suffix === 'm') return n * 1000000;
  return n;
}
