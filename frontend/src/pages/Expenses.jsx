import { useEffect, useState } from 'react';
import { api, formatRupiah, parsePriceInput } from '../services/api.js';
import { inputCls, inlineInputCls, labelCls } from '../styles.js';
import { onDataChanged } from '../components/Tour.jsx';
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import {
  BanknoteIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '../components/Icons.jsx';

// Fixed enum. Keep in sync with backend/src/controllers/expenseController.js
const EXPENSE_CATEGORIES = [
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

// localStorage key for the "last-entered amount per category" ghost-placeholder hint.
// The hint never auto-fills the input — it just shows greyed text the user can choose
// to retype. Per DECISIONS.md, expense entries are always explicit, never carried.
const LAST_AMOUNT_KEY = 'crema.expense-last';
function readLastAmount(category) {
  try {
    const raw = localStorage.getItem(`${LAST_AMOUNT_KEY}:${category}`);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function writeLastAmount(category, amount) {
  try {
    localStorage.setItem(`${LAST_AMOUNT_KEY}:${category}`, String(amount));
  } catch { /* localStorage may be unavailable; silent skip */ }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso) {
  // Backend returns ISO timestamp; show as YYYY-MM-DD for the operator (matches Reports).
  return new Date(iso).toISOString().slice(0, 10);
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add-entry form
  const [form, setForm] = useState({ date: todayStr(), category: EXPENSE_CATEGORIES[0], amount: '', note: '' });
  const [formError, setFormError] = useState(null);
  const [adding, setAdding] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', category: '', amount: '', note: '' });
  const [editError, setEditError] = useState(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // a11y: announce inline outcomes to screen readers
  const [savedMessage, setSavedMessage] = useState('');

  async function load() {
    setLoading(true); setError(null);
    try {
      const data = await api.getExpenses(filterFrom || undefined, filterTo || undefined, filterCategory || undefined);
      setExpenses(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filterCategory, filterFrom, filterTo]);
  useEffect(() => onDataChanged(load), []);

  async function submitAdd(e) {
    e.preventDefault();
    setFormError(null);
    setAdding(true);
    try {
      const amount = parsePriceInput(form.amount);
      if (amount == null || Number.isNaN(amount) || amount < 0) {
        setFormError('Invalid amount. Try 175000, 175k, or 175.000.');
        setAdding(false);
        return;
      }
      await api.createExpense({
        date: form.date,
        category: form.category,
        amount,
        note: form.note?.trim() || null,
      });
      writeLastAmount(form.category, amount);
      setSavedMessage(`Added ${form.category}: ${formatRupiah(amount)}`);
      // Reset only amount + note; keep date and category so the user can keep logging fast.
      setForm((f) => ({ ...f, amount: '', note: '' }));
      load();
    } catch (e) {
      setFormError(e.message);
      setSavedMessage(`Add failed: ${e.message}`);
    } finally {
      setAdding(false);
    }
  }

  function openEdit(exp) {
    setEditTarget(exp);
    setEditForm({
      date: fmtDate(exp.date),
      category: exp.category,
      amount: String(Number(exp.amount)),
      note: exp.note ?? '',
    });
    setEditError(null);
  }

  async function submitEdit(e) {
    e.preventDefault();
    setEditError(null);
    try {
      const amount = parsePriceInput(editForm.amount);
      if (amount == null || Number.isNaN(amount) || amount < 0) {
        setEditError('Invalid amount. Try 175000, 175k, or 175.000.');
        return;
      }
      await api.updateExpense(editTarget.id, {
        date: editForm.date,
        category: editForm.category,
        amount,
        note: editForm.note?.trim() || null,
      });
      setSavedMessage(`Updated ${editForm.category}: ${formatRupiah(amount)}`);
      setEditTarget(null);
      load();
    } catch (e) { setEditError(e.message); }
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError(null);
    try {
      await api.deleteExpense(deleteTarget.id);
      setSavedMessage(`Deleted ${deleteTarget.category} entry`);
      setDeleteTarget(null);
      load();
    } catch (e) { setDeleteError(e.message); }
    finally { setDeleting(false); }
  }

  // Ghost placeholder for the Add-form amount input. Reads last-saved amount for the
  // selected category and shows it as muted helper text. The input value remains empty.
  const lastForSelected = readLastAmount(form.category);

  return (
    <>
      {/* a11y: live region announces add/edit/delete outcomes. Lives OUTSIDE the
          space-y-8 stack so it doesn't push the h1 down by 32px. */}
      <div className="sr-only" role="status" aria-live="polite">{savedMessage}</div>

    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-ink flex items-center gap-3">
          <BanknoteIcon className="w-7 h-7 text-accent" />
          Expenses
        </h1>
      </div>

      {/* Add-entry form. Compact horizontal layout on desktop; stacked on mobile. */}
      <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
        <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider mb-4">Log an expense</div>
        {formError && (
          <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{formError}</div>
        )}
        <form onSubmit={submitAdd} className="grid grid-cols-1 md:grid-cols-[160px_180px_1fr_2fr_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputCls}
            >
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder={lastForSelected ? `Last: ${formatRupiah(lastForSelected)}` : '0'}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className={`${inputCls} tabular`}
              required
            />
            {(() => {
              const n = parsePriceInput(form.amount);
              if (n == null || Number.isNaN(n) || n <= 0) return null;
              return <p className="font-mono text-[10px] text-ink-tertiary mt-1 tabular">= {formatRupiah(n)}</p>;
            })()}
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. April PLN bill"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputCls}
              maxLength={200}
            />
          </div>
          <Button type="submit" variant="cta" disabled={adding}>
            <PlusIcon className="w-4 h-4" />
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </section>

      {/* Filter row + entries table. */}
      <section className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">All entries</div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">From</label>
              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className={`${inputCls} h-9`}
              />
            </div>
            <div>
              <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">To</label>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className={`${inputCls} h-9`}
              />
            </div>
            <div>
              <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`${inputCls} h-9`}
              >
                <option value="">All</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {(filterFrom || filterTo || filterCategory) && (
              <button
                type="button"
                onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterCategory(''); }}
                className="btn-press border border-divider text-ink-secondary hover:bg-elevated rounded-lg px-3 h-9 text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4 mb-4 text-sm">{error}</div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="2.75rem" />)}
          </div>
        )}

        {!loading && expenses.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center min-h-[200px]">
            <BanknoteIcon className="w-12 h-12 text-ink-tertiary/40 mb-3" strokeWidth={1} />
            <p className="text-ink-tertiary text-sm">
              {filterFrom || filterTo || filterCategory
                ? 'No expenses in this filter.'
                : 'No expenses logged yet.'}
            </p>
            <p className="text-ink-tertiary text-xs mt-1">Use the form above to log your first one.</p>
          </div>
        )}

        {!loading && expenses.length > 0 && (
          <>
            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm text-left">
              <thead>
                <tr className="font-mono text-xs text-ink-tertiary uppercase border-b border-divider">
                  <th scope="col" className="px-4 py-3">Date</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                  <th scope="col" className="px-4 py-3">Note</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="group border-b border-divider/40 row-hover">
                    <td className="px-4 py-3 text-ink-secondary tabular">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex bg-elevated/60 border border-divider/60 text-ink-secondary rounded-md px-2 py-0.5 text-xs">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink tabular font-medium">
                      {formatRupiah(e.amount)}
                    </td>
                    <td className="px-4 py-3 text-ink-secondary">
                      {e.note ? <span className="line-clamp-1">{e.note}</span> : <span className="text-ink-tertiary">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          aria-label={`Edit expense from ${fmtDate(e.date)}`}
                          className="icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-accent hover:bg-accent-soft opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeleteTarget(e); setDeleteError(null); }}
                          aria-label={`Delete expense from ${fmtDate(e.date)}`}
                          className="icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-danger hover:bg-danger-soft opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="md:hidden space-y-3" aria-label="Expense entries">
              {expenses.map((e) => (
                <li key={e.id} className="group border border-divider/40 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary tabular">
                        {fmtDate(e.date)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex bg-elevated/60 border border-divider/60 text-ink-secondary rounded-md px-2 py-0.5 text-xs">
                          {e.category}
                        </span>
                        <span className="font-heading text-lg text-ink tabular leading-none">
                          {formatRupiah(e.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        aria-label={`Edit expense from ${fmtDate(e.date)}`}
                        className="icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-accent hover:bg-accent-soft"
                        title="Edit"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteTarget(e); setDeleteError(null); }}
                        aria-label={`Delete expense from ${fmtDate(e.date)}`}
                        className="icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-danger hover:bg-danger-soft"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {e.note && (
                    <div className="text-sm text-ink-secondary">{e.note}</div>
                  )}
                </li>
              ))}
            </ul>

            {/* Range total */}
            <div className="border-t border-divider mt-4 pt-3 flex items-baseline justify-between">
              <span className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">
                {filterFrom || filterTo || filterCategory ? 'Filtered total' : 'All-time total'}
              </span>
              <span className="font-heading text-xl text-ink tabular leading-none">
                {formatRupiah(expenses.reduce((s, e) => s + Number(e.amount), 0))}
              </span>
            </div>
          </>
        )}
      </section>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? 'Edit expense' : ''}
      >
        {editTarget && (
          <form onSubmit={submitEdit} className="space-y-4">
            {editError && (
              <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 text-sm">{editError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className={inputCls}
                >
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className={`${inputCls} tabular`}
                required
              />
              {(() => {
                const n = parsePriceInput(editForm.amount);
                if (n == null || Number.isNaN(n) || n <= 0) return null;
                return <p className="font-mono text-[10px] text-ink-tertiary mt-1 tabular">= {formatRupiah(n)}</p>;
              })()}
            </div>
            <div>
              <label className={labelCls}>Note (optional)</label>
              <input
                type="text"
                value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                className={inputCls}
                maxLength={200}
              />
            </div>
            <Button type="submit" fullWidth size="lg">Save changes</Button>
          </form>
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete expense">
        {deleteError && (
          <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{deleteError}</div>
        )}
        <p className="text-sm text-ink-secondary mb-4">
          Delete the {deleteTarget?.category.toLowerCase()} entry on{' '}
          <span className="font-medium text-ink tabular">{deleteTarget ? fmtDate(deleteTarget.date) : ''}</span>
          {' '}for{' '}
          <span className="font-medium text-ink tabular">{deleteTarget ? formatRupiah(deleteTarget.amount) : ''}</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button onClick={confirmDelete} disabled={deleting} variant="danger" size="lg" className="flex-1">
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button onClick={() => setDeleteTarget(null)} variant="secondary" size="lg" className="flex-1">
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
    </>
  );
}
