import { useEffect, useState } from 'react';
import { api, formatRupiah, parsePriceInput } from '../services/api.js';
import { inputCls, inlineInputCls, labelCls } from '../styles.js';
import { onDataChanged } from '../components/Tour.jsx'; // TOUR
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import Skeleton from '../components/Skeleton.jsx';
import {
  ArchiveIcon,
  PlusIcon,
  TrashIcon,
  AlertTriangleIcon,
} from '../components/Icons.jsx';

export default function Inventory() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [edits, setEdits] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'g', stockQuantity: '', totalPrice: '', lowStockThreshold: '' });
  const [formError, setFormError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // a11y: announce inline edit save/failure outcomes
  const [savedMessage, setSavedMessage] = useState('');

  async function load() {
    setLoading(true); setError(null);
    try { setIngredients(await api.getIngredients()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => onDataChanged(load), []); // TOUR: reload when tour actions create data

  function setEdit(id, field, value) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }
  function hasEdits(id) {
    const e = edits[id];
    return e?.stock !== undefined || e?.threshold !== undefined || e?.cost !== undefined;
  }

  async function saveRow(id, ing) {
    const e = edits[id];
    if (!e) return;
    const data = { stockQuantity: e.stock !== undefined ? Number(e.stock) : Number(ing.stockQuantity) };
    if (e.threshold !== undefined) data.lowStockThreshold = Number(e.threshold);
    if (e.cost !== undefined) data.costPerUnit = e.cost === '' ? null : Number(e.cost);
    try {
      await api.updateIngredient(id, data);
      setEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setSavedMessage(`Saved ${ing.name}`);
      load();
    } catch (err) {
      setError(err.message);
      setSavedMessage(`Save failed for ${ing.name}: ${err.message}`);
    }
  }

  // Auto-save just the stock field on blur. Cost/threshold edits stay pending until Save.
  async function autoSaveStock(id, ing) {
    const e = edits[id];
    if (!e || e.stock === undefined) return;
    if (Number(e.stock) === Number(ing.stockQuantity)) {
      // No actual change, just clear the edit.
      setEdits((prev) => {
        const next = { ...prev };
        const { stock: _drop, ...rest } = next[id] || {};
        if (Object.keys(rest).length === 0) delete next[id]; else next[id] = rest;
        return next;
      });
      return;
    }
    try {
      await api.updateIngredient(id, { stockQuantity: Number(e.stock) });
      setEdits((prev) => {
        const next = { ...prev };
        const { stock: _drop, ...rest } = next[id] || {};
        if (Object.keys(rest).length === 0) delete next[id]; else next[id] = rest;
        return next;
      });
      setSavedMessage(`Stock saved for ${ing.name}: ${Number(e.stock)} ${ing.unit}`);
      load();
    } catch (err) {
      setError(err.message);
      setSavedMessage(`Stock save failed for ${ing.name}: ${err.message}`);
    }
  }

  async function addIngredient(e) {
    e.preventDefault(); setFormError(null);
    try {
      const stock = Number(form.stockQuantity);
      const total = parsePriceInput(form.totalPrice);
      if (total != null && Number.isNaN(total)) {
        setFormError('Invalid total price. Try 25000, 25k, or 25.000.');
        return;
      }
      const costPerUnit = total != null && stock > 0 ? total / stock : null;
      await api.createIngredient({
        name: form.name, unit: form.unit,
        stockQuantity: stock,
        costPerUnit,
        lowStockThreshold: form.lowStockThreshold === '' ? 100 : Number(form.lowStockThreshold),
      });
      setForm({ name: '', unit: 'g', stockQuantity: '', totalPrice: '', lowStockThreshold: '' });
      setShowAdd(false); load();
    } catch (e) { setFormError(e.message); }
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError(null);
    try { await api.deleteIngredient(deleteTarget.id); setDeleteTarget(null); load(); }
    catch (e) { setDeleteError(e.message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      {/* a11y: live region announces inline edit save/failure. Lives OUTSIDE the
          space-y-8 stack so it doesn't push the h1 down by 32px (Tailwind's space-y
          applies margin-top to every sibling after the first, regardless of whether
          the first is visually hidden). */}
      <div className="sr-only" role="status" aria-live="polite">{savedMessage}</div>

    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-ink flex items-center gap-3">
          <ArchiveIcon className="w-7 h-7 text-accent" />
          Inventory
        </h1>
        <Button onClick={() => setShowAdd(true)}>
          <PlusIcon className="w-4 h-4" />
          Add ingredient
        </Button>
      </div>

      <section data-tour="inventory-table" className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} width="100%" height="2.75rem" />)}
          </div>
        )}
        {error && (
          <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4 mb-4 text-sm">{error}</div>
        )}
        {!loading && ingredients.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center min-h-[280px]">
            <ArchiveIcon className="w-12 h-12 text-ink-tertiary/40 mb-3" strokeWidth={1} />
            <p className="text-ink-tertiary text-sm">No ingredients yet</p>
            <p className="text-ink-tertiary text-sm mt-1">Click "Add ingredient" to get started.</p>
          </div>
        )}
        {ingredients.length > 0 && (
          <>
            {/* Desktop table (md+) */}
            <table className="hidden md:table w-full text-sm text-left">
              <thead>
                <tr className="font-mono text-xs text-ink-tertiary uppercase border-b border-divider">
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Unit</th>
                  <th scope="col" className="px-4 py-3">Stock</th>
                  <th scope="col" className="px-4 py-3">Cost / unit</th>
                  <th scope="col" className="px-4 py-3">Low alert</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => {
                  const isLow = Number(ing.stockQuantity) < Number(ing.lowStockThreshold);
                  const rowCls = `group row-hover border-b border-divider/40 ${isLow ? 'bg-danger-soft/30' : ''}`;
                  return (
                    <tr key={ing.id} data-tour-ingredient={ing.name} className={rowCls}>
                      <td className={`px-4 py-3 text-ink font-medium ${isLow ? 'border-l-4 border-danger' : ''}`}>
                        <span className="inline-flex items-center gap-2">
                          {isLow && (
                            <AlertTriangleIcon
                              className="w-3.5 h-3.5 text-danger"
                              aria-label={`${ing.name} is below the low-stock threshold`}
                            />
                          )}
                          {ing.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{ing.unit}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number" step="0.01" min="0"
                          value={edits[ing.id]?.stock ?? Number(ing.stockQuantity)}
                          onChange={(e) => setEdit(ing.id, 'stock', e.target.value)}
                          onBlur={() => autoSaveStock(ing.id, ing)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className={`${inlineInputCls} tabular`}
                          aria-label={`${ing.name} stock in ${ing.unit}`}
                          title="Auto-saves on blur or Enter"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" step="0.01" min="0"
                          placeholder="—"
                          value={edits[ing.id]?.cost ?? (ing.costPerUnit != null ? Number(ing.costPerUnit) : '')}
                          onChange={(e) => setEdit(ing.id, 'cost', e.target.value)}
                          className={`${inlineInputCls} tabular`}
                          aria-label={`${ing.name} cost per ${ing.unit}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number" step="0.01" min="0"
                          value={edits[ing.id]?.threshold ?? Number(ing.lowStockThreshold)}
                          onChange={(e) => setEdit(ing.id, 'threshold', e.target.value)}
                          className={`${inlineInputCls} tabular`}
                          aria-label={`${ing.name} low-stock alert threshold`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          ing={ing}
                          dirty={hasEdits(ing.id)}
                          onSave={() => saveRow(ing.id, ing)}
                          onDelete={() => { setDeleteTarget(ing); setDeleteError(null); }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile card list (below md). Same data + auto-save behavior, stacked. */}
            <ul className="md:hidden space-y-3" aria-label="Ingredients">
              {ingredients.map((ing) => {
                const isLow = Number(ing.stockQuantity) < Number(ing.lowStockThreshold);
                const cardCls = `group border rounded-xl p-4 space-y-3 ${isLow ? 'border-danger/40 bg-danger-soft/30' : 'border-divider/40'}`;
                return (
                  <li key={ing.id} data-tour-ingredient={ing.name} className={cardCls}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-heading text-lg text-ink leading-tight inline-flex items-center gap-2 min-w-0">
                        {isLow && (
                          <AlertTriangleIcon
                            className="w-4 h-4 text-danger flex-shrink-0"
                            aria-label={`${ing.name} is below the low-stock threshold`}
                          />
                        )}
                        <span className="truncate">{ing.name}</span>
                        <span className="font-mono text-xs text-ink-tertiary uppercase tracking-wider flex-shrink-0">
                          {ing.unit}
                        </span>
                      </h3>
                      <RowActions
                        ing={ing}
                        dirty={hasEdits(ing.id)}
                        onSave={() => saveRow(ing.id, ing)}
                        onDelete={() => { setDeleteTarget(ing); setDeleteError(null); }}
                        iconAlwaysVisible
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">Stock</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={edits[ing.id]?.stock ?? Number(ing.stockQuantity)}
                          onChange={(e) => setEdit(ing.id, 'stock', e.target.value)}
                          onBlur={() => autoSaveStock(ing.id, ing)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className={`${inlineInputCls} tabular w-full`}
                          aria-label={`${ing.name} stock in ${ing.unit}`}
                          title="Auto-saves on blur or Enter"
                        />
                      </div>
                      <div>
                        <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">Cost/{ing.unit}</label>
                        <input
                          type="number" step="0.01" min="0"
                          placeholder="—"
                          value={edits[ing.id]?.cost ?? (ing.costPerUnit != null ? Number(ing.costPerUnit) : '')}
                          onChange={(e) => setEdit(ing.id, 'cost', e.target.value)}
                          className={`${inlineInputCls} tabular w-full`}
                          aria-label={`${ing.name} cost per ${ing.unit}`}
                        />
                      </div>
                      <div>
                        <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">Low alert</label>
                        <input
                          type="number" step="0.01" min="0"
                          value={edits[ing.id]?.threshold ?? Number(ing.lowStockThreshold)}
                          onChange={(e) => setEdit(ing.id, 'threshold', e.target.value)}
                          className={`${inlineInputCls} tabular w-full`}
                          aria-label={`${ing.name} low-stock alert threshold`}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Add ingredient modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setFormError(null); }} title="Add ingredient">
        {formError && (
          <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{formError}</div>
        )}
        <form onSubmit={addIngredient} className="space-y-4">
          {/* Section: Identity */}
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">Identity</div>
          <div>
            <label className={labelCls}>Name</label>
            <input placeholder="e.g. Coffee Beans" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required autoFocus />
          </div>

          {/* Section: Stock & pricing */}
          <div className="pt-2 border-t border-divider/60 font-mono text-[10px] uppercase tracking-wider text-ink-tertiary">Stock & pricing</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unit</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputCls}>
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Initial stock</label>
              <input type="number" step="0.01" min="0" placeholder="0" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className={inputCls} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Total price paid</label>
              <input type="text" inputMode="decimal" placeholder="25.000 or 25k" value={form.totalPrice} onChange={(e) => setForm({ ...form, totalPrice: e.target.value })} className={inputCls} />
              {(() => {
                const total = parsePriceInput(form.totalPrice);
                const stock = Number(form.stockQuantity);
                if (total == null || Number.isNaN(total) || total < 0 || !(stock > 0)) return null;
                return (
                  <p className="font-mono text-[10px] text-ink-tertiary mt-1 tabular">
                    {formatRupiah(total)} ÷ {stock} {form.unit} = Rp {(total / stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} / {form.unit}
                  </p>
                );
              })()}
            </div>
            <div>
              <label className={labelCls}>Low stock alert</label>
              <input type="number" step="0.01" min="0" placeholder="100" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className={inputCls} />
            </div>
          </div>
          <Button type="submit" variant="cta" fullWidth size="lg">Add ingredient</Button>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete ingredient">
        {deleteError && (
          <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{deleteError}</div>
        )}
        <p className="text-sm text-ink-secondary mb-4">
          Are you sure you want to delete <span className="font-medium text-ink">{deleteTarget?.name}</span>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button onClick={confirmDelete} disabled={deleting} variant="danger" size="lg" className="flex-1">
            {deleting ? 'Deleting...' : 'Delete'}
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

// ── Row actions ──
// Save button only renders when there are pending threshold/cost edits (stock auto-saves
// on blur, so it never needs Save). On the desktop table, the Delete icon fades in on row
// hover OR keyboard focus within the row. On mobile cards, the icon stays visible since
// hover doesn't exist on touch.
function RowActions({ ing, dirty, onSave, onDelete, iconAlwaysVisible = false }) {
  const idleIconCls = iconAlwaysVisible
    ? 'opacity-100'
    : 'opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity';
  return (
    <div className="flex items-center justify-end gap-2">
      {dirty && (
        <button
          type="button"
          onClick={onSave}
          aria-label={`Save changes to ${ing.name}`}
          className="btn-press bg-success hover:bg-success-hover text-white rounded-lg px-3 py-1 text-sm font-medium animate-fade-in"
        >
          Save
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${ing.name}`}
        className={`icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-danger hover:bg-danger-soft focus-visible:opacity-100 ${idleIconCls}`}
        title="Delete"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
