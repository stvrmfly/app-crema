import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupiah, parsePriceInput } from '../services/api.js';
import { inputCls, inlineInputCls, labelCls } from '../styles.js';
import { onDataChanged } from '../components/Tour.jsx'; // TOUR
import Modal from '../components/Modal.jsx';
import Button from '../components/Button.jsx';
import {
  CubeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from '../components/Icons.jsx';

const blankRecipeRow = () => ({ ingredientId: '', quantityRequired: '' });

function makeRecipeRowHandlers(state, setState) {
  return {
    update: (idx, field, value) =>
      setState({ ...state, recipe: state.recipe.map((row, i) => (i === idx ? { ...row, [field]: value } : row)) }),
    add: () => setState({ ...state, recipe: [...state.recipe, blankRecipeRow()] }),
    remove: (idx) => setState({ ...state, recipe: state.recipe.filter((_, i) => i !== idx) }),
  };
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', recipe: [blankRecipeRow()] });
  const [formError, setFormError] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', recipe: [blankRecipeRow()] });
  const [editError, setEditError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickForm, setQuickForm] = useState({ name: '', unit: 'g', stockQuantity: '', totalPrice: '' });
  const [quickError, setQuickError] = useState(null);
  const [priceEdits, setPriceEdits] = useState({});
  // a11y: announce inline price-save outcome to screen readers.
  const [savedMessage, setSavedMessage] = useState('');

  async function load() {
    setLoading(true); setError(null);
    try {
      const [p, i] = await Promise.all([api.getProducts(), api.getIngredients()]);
      setProducts(p); setIngredients(i);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => onDataChanged(load), []); // TOUR

  const addRecipe = makeRecipeRowHandlers(form, setForm);

  async function submit(e) {
    e.preventDefault(); setFormError(null);
    const recipe = form.recipe.filter((r) => r.ingredientId !== '' && r.quantityRequired !== '')
      .map((r) => ({ ingredientId: Number(r.ingredientId), quantityRequired: Number(r.quantityRequired) }));
    try {
      const price = parsePriceInput(form.price);
      if (price == null || Number.isNaN(price) || price < 0) { setFormError('Invalid price. Try 25000, 25k, or 25.000.'); return; }
      await api.createProduct({ name: form.name, price, recipe });
      setForm({ name: '', price: '', recipe: [blankRecipeRow()] }); setShowAdd(false); load();
    } catch (e) { setFormError(e.message); }
  }

  function openEdit(p) {
    setEditProduct(p);
    setEditForm({
      name: p.name,
      price: String(Number(p.price)),
      recipe: p.recipes.length > 0
        ? p.recipes.map((r) => ({ ingredientId: String(r.ingredient.id), quantityRequired: String(Number(r.quantityRequired)) }))
        : [blankRecipeRow()],
    });
    setEditError(null);
  }
  const editRecipe = makeRecipeRowHandlers(editForm, setEditForm);
  async function submitEdit(e) {
    e.preventDefault(); setEditError(null);
    const recipe = editForm.recipe.filter((r) => r.ingredientId !== '' && r.quantityRequired !== '')
      .map((r) => ({ ingredientId: Number(r.ingredientId), quantityRequired: Number(r.quantityRequired) }));
    try {
      const price = parsePriceInput(editForm.price);
      if (price == null || Number.isNaN(price) || price < 0) { setEditError('Invalid price. Try 25000, 25k, or 25.000.'); return; }
      await api.updateProduct(editProduct.id, { name: editForm.name, price, recipe });
      setEditProduct(null); load();
    } catch (e) { setEditError(e.message); }
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError(null);
    try { await api.deleteProduct(deleteTarget.id); setDeleteTarget(null); load(); }
    catch (e) { setDeleteError(e.message); }
    finally { setDeleting(false); }
  }

  async function submitQuickAdd(e) {
    e.preventDefault(); setQuickError(null);
    try {
      const stock = Number(quickForm.stockQuantity);
      const total = parsePriceInput(quickForm.totalPrice);
      if (total != null && Number.isNaN(total)) { setQuickError('Invalid total price. Try 25000, 25k, or 25.000.'); return; }
      const costPerUnit = total != null && stock > 0 ? total / stock : null;
      await api.createIngredient({ name: quickForm.name, unit: quickForm.unit, stockQuantity: stock, costPerUnit });
      setIngredients(await api.getIngredients());
      setQuickForm({ name: '', unit: 'g', stockQuantity: '', totalPrice: '' }); setShowQuickAdd(false);
    } catch (e) { setQuickError(e.message); }
  }

  function hasPriceEdit(id) { return priceEdits[id] !== undefined; }
  async function savePrice(id) {
    const val = priceEdits[id];
    if (val === undefined) return;
    const price = parsePriceInput(val);
    if (price == null || Number.isNaN(price) || price < 0) {
      setError('Invalid price. Try 25000, 25k, or 25.000.');
      setSavedMessage('Save failed: invalid price');
      return;
    }
    try {
      await api.updateProduct(id, { price });
      const product = products.find((p) => p.id === id);
      setPriceEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setSavedMessage(`Price saved for ${product?.name ?? 'product'}: ${formatRupiah(price)}`);
      load();
    } catch (e) {
      setError(e.message);
      setSavedMessage(`Save failed: ${e.message}`);
    }
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
          <CubeIcon className="w-7 h-7 text-accent" />
          Products
        </h1>
        <Button onClick={() => setShowAdd(true)}>
          <PlusIcon className="w-4 h-4" />
          Add product
        </Button>
      </div>

      <section data-tour="products-table" className="card-gradient border border-divider/60 rounded-2xl shadow-ambient p-6">
        {loading && <p className="text-ink-secondary text-sm">Loading...</p>}
        {error && <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-4 mb-4 text-sm">{error}</div>}
        {!loading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center min-h-[280px]">
            <CubeIcon className="w-12 h-12 text-ink-tertiary/40 mb-3" strokeWidth={1} />
            <p className="text-ink-tertiary text-sm">No products yet</p>
            <p className="text-ink-tertiary text-sm mt-1">
              {ingredients.length === 0 ? (<>Add ingredients in <Link to="/inventory" className="text-ink font-medium underline decoration-accent/40 hover:decoration-accent">Inventory</Link> first.</>) : (<>Click "Add product" to get started.</>)}
            </p>
          </div>
        )}
        {products.length > 0 && (
          <>
            {/* Desktop table (md+) */}
            <table className="hidden md:table w-full text-sm text-left">
              <thead>
                <tr className="font-mono text-xs text-ink-tertiary uppercase border-b border-divider">
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Price</th>
                  <th scope="col" className="px-4 py-3">Recipe</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="group border-b border-divider/40 row-hover">
                    <td className="px-4 py-3 text-ink font-medium">{p.name}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text" inputMode="decimal"
                        value={priceEdits[p.id] ?? Number(p.price)}
                        onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className={`${inlineInputCls} tabular`}
                        aria-label={`${p.name} price in rupiah`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <RecipeChips recipes={p.recipes} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        product={p}
                        dirty={hasPriceEdit(p.id)}
                        onSave={() => savePrice(p.id)}
                        onEdit={() => openEdit(p)}
                        onDelete={() => { setDeleteTarget(p); setDeleteError(null); }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile card list (below md). Same data, stacked. */}
            <ul className="md:hidden space-y-3" aria-label="Products">
              {products.map((p) => (
                <li key={p.id} className="group border border-divider/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-lg text-ink leading-tight min-w-0 truncate">
                      {p.name}
                    </h3>
                    <RowActions
                      product={p}
                      dirty={hasPriceEdit(p.id)}
                      onSave={() => savePrice(p.id)}
                      onEdit={() => openEdit(p)}
                      onDelete={() => { setDeleteTarget(p); setDeleteError(null); }}
                      iconAlwaysVisible
                    />
                  </div>
                  <div>
                    <label className="font-mono block text-[10px] uppercase tracking-wider text-ink-tertiary mb-1">Price</label>
                    <input
                      type="text" inputMode="decimal"
                      value={priceEdits[p.id] ?? Number(p.price)}
                      onChange={(e) => setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className={`${inlineInputCls} tabular w-full`}
                      aria-label={`${p.name} price in rupiah`}
                    />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-ink-tertiary mb-1.5">Recipe</div>
                    <RecipeChips recipes={p.recipes} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Add product modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setFormError(null); }} title="Add product">
        {formError && <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{formError}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input placeholder="e.g. Latte" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required autoFocus />
            </div>
            <div>
              <label className={labelCls}>Price (Rp)</label>
              <input type="text" inputMode="decimal" placeholder="25.000 or 25k" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} required />
              {(() => {
                const n = parsePriceInput(form.price);
                if (n == null || Number.isNaN(n) || n <= 0) return null;
                return <p className="font-mono text-[10px] text-ink-tertiary mt-1 tabular">= {formatRupiah(n)}</p>;
              })()}
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-divider/60">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">Recipe</div>
              <button type="button" onClick={() => setShowQuickAdd(true)} className="btn-press text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1">
                <PlusIcon className="w-3.5 h-3.5" />
                New ingredient
              </button>
            </div>
            {form.recipe.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
                <select value={row.ingredientId} onChange={(e) => addRecipe.update(idx, 'ingredientId', e.target.value)} className={inputCls} aria-label={`Recipe row ${idx + 1} ingredient`}>
                  <option value="">Select ingredient...</option>
                  {ingredients.map((ing) => (<option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>))}
                </select>
                <input type="number" step="0.01" min="0" placeholder="Qty" value={row.quantityRequired} onChange={(e) => addRecipe.update(idx, 'quantityRequired', e.target.value)} className={inputCls} aria-label={`Recipe row ${idx + 1} quantity`} />
                <button
                  type="button"
                  onClick={() => addRecipe.remove(idx)}
                  disabled={form.recipe.length === 1}
                  aria-label={`Remove recipe row ${idx + 1}`}
                  className="btn-press hit-target w-9 h-9 flex items-center justify-center border border-divider text-ink-tertiary hover:text-danger hover:border-danger/30 disabled:opacity-40 rounded-lg"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addRecipe.add} className="btn-press border border-dashed border-divider text-ink-secondary hover:border-ink-tertiary hover:text-ink rounded-lg px-3 py-2 text-sm w-full">
              + Add recipe row
            </button>
          </div>
          <Button type="submit" variant="cta" fullWidth size="lg">Create product</Button>
        </form>
      </Modal>

      {/* Edit product modal */}
      <Modal open={!!editProduct} onClose={() => setEditProduct(null)} title={editProduct ? `Edit ${editProduct.name}` : ''}>
        {editError && <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{editError}</div>}
        <form onSubmit={submitEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} required autoFocus />
            </div>
            <div>
              <label className={labelCls}>Price (Rp)</label>
              <input type="text" inputMode="decimal" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className={inputCls} required />
              {(() => {
                const n = parsePriceInput(editForm.price);
                if (n == null || Number.isNaN(n) || n <= 0) return null;
                return <p className="font-mono text-[10px] text-ink-tertiary mt-1 tabular">= {formatRupiah(n)}</p>;
              })()}
            </div>
          </div>
          <div className="space-y-2 pt-2 border-t border-divider/60">
            <div className="font-mono text-xs text-ink-tertiary uppercase tracking-wider">Recipe</div>
            {editForm.recipe.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
                <select value={row.ingredientId} onChange={(e) => editRecipe.update(idx, 'ingredientId', e.target.value)} className={inputCls} aria-label={`Recipe row ${idx + 1} ingredient`}>
                  <option value="">Select ingredient...</option>
                  {ingredients.map((ing) => (<option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>))}
                </select>
                <input type="number" step="0.01" min="0" placeholder="Qty" value={row.quantityRequired} onChange={(e) => editRecipe.update(idx, 'quantityRequired', e.target.value)} className={inputCls} aria-label={`Recipe row ${idx + 1} quantity`} />
                <button
                  type="button"
                  onClick={() => editRecipe.remove(idx)}
                  disabled={editForm.recipe.length === 1}
                  aria-label={`Remove recipe row ${idx + 1}`}
                  className="btn-press hit-target w-9 h-9 flex items-center justify-center border border-divider text-ink-tertiary hover:text-danger hover:border-danger/30 disabled:opacity-40 rounded-lg"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={editRecipe.add} className="btn-press border border-dashed border-divider text-ink-secondary hover:border-ink-tertiary hover:text-ink rounded-lg px-3 py-2 text-sm w-full">
              + Add recipe row
            </button>
          </div>
          <Button type="submit" fullWidth size="lg">Save changes</Button>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete product">
        {deleteError && <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{deleteError}</div>}
        <p className="text-sm text-ink-secondary mb-4">Are you sure you want to delete <span className="font-medium text-ink">{deleteTarget?.name}</span>? This will also remove its recipe.</p>
        <div className="flex gap-3">
          <Button onClick={confirmDelete} disabled={deleting} variant="danger" size="lg" className="flex-1">{deleting ? 'Deleting...' : 'Delete'}</Button>
          <Button onClick={() => setDeleteTarget(null)} variant="secondary" size="lg" className="flex-1">Cancel</Button>
        </div>
      </Modal>

      {/* Quick-add ingredient modal */}
      <Modal open={showQuickAdd} onClose={() => { setShowQuickAdd(false); setQuickError(null); }} title="Quick add ingredient">
        {quickError && <div className="animate-fade-in bg-danger-soft border border-danger/20 text-danger rounded-2xl p-3 mb-4 text-sm">{quickError}</div>}
        <form onSubmit={submitQuickAdd} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input placeholder="e.g. Milk" value={quickForm.name} onChange={(e) => setQuickForm({ ...quickForm, name: e.target.value })} className={inputCls} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Unit</label>
              <select value={quickForm.unit} onChange={(e) => setQuickForm({ ...quickForm, unit: e.target.value })} className={inputCls}>
                <option value="g">g</option><option value="ml">ml</option><option value="pcs">pcs</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Initial stock</label>
              <input type="number" step="0.01" min="0" placeholder="0" value={quickForm.stockQuantity} onChange={(e) => setQuickForm({ ...quickForm, stockQuantity: e.target.value })} className={inputCls} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Total price paid</label>
            <input type="text" inputMode="decimal" placeholder="25.000 or 25k" value={quickForm.totalPrice} onChange={(e) => setQuickForm({ ...quickForm, totalPrice: e.target.value })} className={inputCls} />
            {(() => {
              const total = parsePriceInput(quickForm.totalPrice);
              const stock = Number(quickForm.stockQuantity);
              if (total == null || Number.isNaN(total) || total < 0 || !(stock > 0)) return null;
              return (
                <p className="font-mono text-[10px] text-ink-tertiary mt-1 tabular">
                  {formatRupiah(total)} ÷ {stock} {quickForm.unit} = Rp {(total / stock).toLocaleString('id-ID', { maximumFractionDigits: 2 })} / {quickForm.unit}
                </p>
              );
            })()}
          </div>
          <Button type="submit" fullWidth size="lg">Add ingredient</Button>
        </form>
      </Modal>
    </div>
    </>
  );
}

// ── Recipe chips ──
// Replaces the old comma-joined string with discrete pills so each ingredient is
// individually scannable. `tabular` on the quantity keeps numbers aligned across rows.
function RecipeChips({ recipes }) {
  if (!recipes || recipes.length === 0) {
    return <span className="text-ink-tertiary">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {recipes.map((r) => (
        <span
          key={r.id ?? `${r.ingredient.id}-${r.quantityRequired}`}
          className="inline-flex items-baseline gap-1 bg-elevated/60 border border-divider/60 text-ink-secondary rounded-md px-2 py-0.5 text-xs"
        >
          <span className="tabular font-medium text-ink">{Number(r.quantityRequired)}</span>
          <span className="text-ink-tertiary">{r.ingredient.unit}</span>
          <span className="text-ink-secondary">·</span>
          <span>{r.ingredient.name}</span>
        </span>
      ))}
    </div>
  );
}

// ── Row actions ──
// Save button only renders when there's a pending price edit (less visual noise on
// idle rows). On the table, edit/delete icons fade in on row hover OR keyboard focus
// within the row. On mobile cards, icons stay visible (iconAlwaysVisible).
function RowActions({ product, dirty, onSave, onEdit, onDelete, iconAlwaysVisible = false }) {
  const idleIconCls = iconAlwaysVisible
    ? 'opacity-100'
    : 'opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity';
  return (
    <div className="flex items-center justify-end gap-1">
      {dirty && (
        <button
          type="button"
          onClick={onSave}
          aria-label={`Save price for ${product.name}`}
          className="btn-press bg-success hover:bg-success-hover text-white rounded-lg px-3 py-1 text-sm font-medium mr-1.5 animate-fade-in"
        >
          Save
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${product.name}`}
        className={`icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-accent hover:bg-accent-soft focus-visible:opacity-100 ${idleIconCls}`}
        title="Edit"
      >
        <PencilIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${product.name}`}
        className={`icon-btn hit-target p-1.5 rounded-lg text-ink-tertiary hover:text-danger hover:bg-danger-soft focus-visible:opacity-100 ${idleIconCls}`}
        title="Delete"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
