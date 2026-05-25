import { prisma } from '../prisma.js';

// Fixed expense category enum. Validated on every create/update. Adding a new category
// requires a code change here AND in the frontend constant — kept deliberately tight
// to keep the per-category XLSX roll-up consistent.
export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Water',
  'Gas',
  'Internet',
  'Rent',
  'Salary',
  'Delivery',
  'Transport',
  'Packaging',
  'Miscellaneous',
];

function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function listExpenses(req, res, next) {
  try {
    const { from, to, category } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) {
        if (!isValidIsoDate(from)) {
          return res.status(400).json({ error: 'Invalid "from" date. Use YYYY-MM-DD.' });
        }
        where.date.gte = new Date(from + 'T00:00:00+07:00');
      }
      if (to) {
        if (!isValidIsoDate(to)) {
          return res.status(400).json({ error: 'Invalid "to" date. Use YYYY-MM-DD.' });
        }
        where.date.lte = new Date(to + 'T23:59:59.999+07:00');
      }
    }
    if (category) {
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Allowed: ${EXPENSE_CATEGORIES.join(', ')}` });
      }
      where.category = category;
    }
    const expenses = await prisma.expenseEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
}

export async function createExpense(req, res, next) {
  try {
    const { date, category, amount, note } = req.body;
    if (!isValidIsoDate(date)) {
      return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    }
    if (!EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Allowed: ${EXPENSE_CATEGORIES.join(', ')}` });
    }
    if (amount == null || Number.isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ error: 'amount must be a non-negative number' });
    }
    const expense = await prisma.expenseEntry.create({
      data: {
        // Store the date at WIB midnight so calendar-day filters are consistent with
        // how orders/timestamps are handled elsewhere in the app.
        date: new Date(date + 'T00:00:00+07:00'),
        category,
        amount: Number(amount),
        note: note?.toString().trim() || null,
      },
    });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }
    const existing = await prisma.expenseEntry.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });

    const { date, category, amount, note } = req.body;
    const data = {};
    if (date !== undefined) {
      if (!isValidIsoDate(date)) {
        return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD.' });
      }
      data.date = new Date(date + 'T00:00:00+07:00');
    }
    if (category !== undefined) {
      if (!EXPENSE_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `Invalid category. Allowed: ${EXPENSE_CATEGORIES.join(', ')}` });
      }
      data.category = category;
    }
    if (amount !== undefined) {
      if (Number.isNaN(Number(amount)) || Number(amount) < 0) {
        return res.status(400).json({ error: 'amount must be a non-negative number' });
      }
      data.amount = Number(amount);
    }
    if (note !== undefined) {
      data.note = note === null ? null : (note.toString().trim() || null);
    }

    const expense = await prisma.expenseEntry.update({ where: { id }, data });
    res.json(expense);
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id must be an integer' });
    }
    const existing = await prisma.expenseEntry.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    await prisma.expenseEntry.delete({ where: { id } });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    next(err);
  }
}
