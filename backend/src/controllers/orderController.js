import { createOrder, listOrders, voidOrder } from '../services/orderService.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseWibRange(fromStr, toStr) {
  if (!fromStr && !toStr) return {};
  const validFmt = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (fromStr && !validFmt(fromStr)) throw Object.assign(new Error('Invalid "from" format. Use YYYY-MM-DD.'), { status: 400 });
  if (toStr && !validFmt(toStr)) throw Object.assign(new Error('Invalid "to" format. Use YYYY-MM-DD.'), { status: 400 });

  let from = fromStr;
  let to = toStr;
  if (from && to && from > to) [from, to] = [to, from];

  const range = {};
  if (from) range.from = new Date(from + 'T00:00:00+07:00');
  if (to) range.to = new Date(to + 'T23:59:59.999+07:00');
  return range;
}

export async function getOrders(req, res, next) {
  try {
    const { from, to } = parseWibRange(req.query.from, req.query.to);
    const orders = await listOrders({ from, to });
    res.json(orders);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

export async function postOrder(req, res, next) {
  try {
    const order = await createOrder(req.body?.items);
    res.status(201).json(order);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message, ...(err.details ?? {}) });
    }
    next(err);
  }
}

export async function deleteOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    const result = await voidOrder(id);
    res.json(result);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}
