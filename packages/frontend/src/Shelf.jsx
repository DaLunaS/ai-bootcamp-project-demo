import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';

const STORAGE_LABELS = { ambient: 'Out of fridge', fridge: 'Fridge', freezer: 'Freezer' };

async function loadInventory() {
  const response = await fetch('/api/inventory', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not load your shelf. Check that the backend is running.');
  return response.json();
}

async function loadIngredients() {
  const response = await fetch('/api/ingredients', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Could not load ingredients. Check that the backend is running.');
  return response.json();
}

async function postInventory(url, body) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Could not update your shelf. Please try again.');
  }
  return response.json();
}

async function loadFreshness(id) {
  const at = new Date().toISOString();
  const response = await fetch(`/api/inventory/${encodeURIComponent(id)}/freshness?at=${encodeURIComponent(at)}`);
  if (!response.ok) throw new Error('Freshness unavailable');
  return response.json();
}

function LotCard({ lot }) {
  const queryClient = useQueryClient();
  const freshness = useQuery({
    queryKey: ['freshness', lot.id], queryFn: () => loadFreshness(lot.id),
  });
  const storageChange = useMutation({
    mutationFn: (storage) => postInventory(`/api/inventory/${encodeURIComponent(lot.id)}/storage`, {
      storage, at: new Date().toISOString(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['freshness', lot.id] });
    },
  });
  const storage = lot.storageHistory?.at(-1)?.storage;
  const used = freshness.data?.expired ? 100
    : freshness.data ? Math.min(100, Math.max(0, Math.round(freshness.data.progress * 100))) : 0;

  return (
    <li>
      <article className="shelf-card" aria-label={lot.ingredient.name}>
        <div className="shelf-card-top">
          <span className="shelf-icon" aria-hidden="true"><Inventory2RoundedIcon fontSize="small" /></span>
          <span className="storage-tag">{STORAGE_LABELS[storage] ?? 'Unknown storage'}</span>
        </div>
        <h3>{lot.ingredient.name}</h3>
        <p className="shelf-quantity">{lot.quantity} {lot.unit} on hand</p>
        <p className="shelf-purchased">Purchased {new Date(lot.purchasedAt).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}</p>
        {lot.ingredient.canFreeze && (
          <label className="shelf-freezer-switch">
            <input type="checkbox" checked={storage === 'freezer'} disabled={storageChange.isPending}
              onChange={(event) => storageChange.mutate(event.target.checked ? 'freezer' : 'fridge')} />
            Store in freezer
          </label>
        )}
        {storageChange.isError && <p role="alert" className="shelf-warning">{storageChange.error.message}</p>}
        {freshness.isPending && <p role="status" className="shelf-status">Checking freshness…</p>}
        {freshness.isError && <p className="shelf-warning">Freshness unavailable</p>}
        {freshness.isSuccess && (
          <div className="shelf-freshness">
            <div className="shelf-freshness-head">
              <span>Estimated shelf life</span>
              <span className={freshness.data.expired ? 'shelf-expired' : 'shelf-used'}>
                {freshness.data.expired ? 'Expired' : `${used}% used`}
              </span>
            </div>
            <div className="shelf-meter" role="progressbar" aria-label="Freshness used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={used}>
              <span className={freshness.data.expired ? 'shelf-meter-expired' : ''} style={{ width: `${used}%` }} />
            </div>
            <small>Estimate only — check the package date and food safety guidance.</small>
          </div>
        )}
      </article>
    </li>
  );
}

export default function Shelf() {
  const [formOpen, setFormOpen] = useState(false);
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [storage, setStorage] = useState('fridge');
  const [purchasedDate, setPurchasedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [packagingDate, setPackagingDate] = useState('');
  const queryClient = useQueryClient();
  const inventory = useQuery({ queryKey: ['inventory'], queryFn: loadInventory });
  const catalog = useQuery({ queryKey: ['ingredients'], queryFn: loadIngredients });
  const lots = inventory.data ?? [];
  const selected = catalog.data?.find((ingredient) => ingredient.id === ingredientId) ?? catalog.data?.[0];
  const purchase = useMutation({
    mutationFn: (body) => postInventory('/api/inventory', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setQuantity('');
      setPackagingDate('');
      setFormOpen(false);
    },
  });

  const submit = (event) => {
    event.preventDefault();
    if (!selected) return;
    purchase.mutate({
      ingredientId: selected.id,
      quantity: Number(quantity),
      unit: selected.unit,
      purchasedAt: `${purchasedDate}T00:00:00.000Z`,
      storage,
      ...(packagingDate ? { expiresAt: `${packagingDate}T23:59:59.999Z` } : {}),
    });
  };

  return (
    <section className="shelf-page" aria-labelledby="shelf-heading">
      <div className="shelf-hero">
        <div>
          <p className="eyebrow">WHAT YOU HAVE</p>
          <h1 id="shelf-heading">Your kitchen <em>shelf.</em></h1>
          <p>See what you really have on hand, where it is stored, and how much shelf life has been used.</p>
        </div>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { purchase.reset(); setFormOpen(true); }}>Add a purchase</Button>
      </div>

      {formOpen && (
        <form className="ingredient-form shelf-form" aria-label="Add purchase form" onSubmit={submit}>
          <div className="form-head"><h2>New purchase</h2><p>Only record food you actually have at home.</p></div>
          {catalog.isPending && <p role="status">Loading ingredients…</p>}
          {catalog.isError && <p role="alert">{catalog.error.message}</p>}
          {catalog.isSuccess && catalog.data.length === 0 && <p>Add an ingredient in the Ingredients tab first.</p>}
          {catalog.isSuccess && catalog.data.length > 0 && (
            <>
              <div className="form-grid">
                <label className="field field-wide">Ingredient
                  <select value={selected?.id ?? ''} onChange={(event) => { setIngredientId(event.target.value); setStorage('fridge'); }}>
                    {catalog.data.map((ingredient) => <option value={ingredient.id} key={ingredient.id}>{ingredient.name}</option>)}
                  </select>
                </label>
                <label className="field">Quantity ({selected.unit})
                  <input required min={selected.unit === 'units' ? '1' : '0.000001'} step={selected.unit === 'units' ? '1' : 'any'} type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </label>
                <label className="field">Purchase date
                  <input required type="date" max={new Date().toISOString().slice(0, 10)} value={purchasedDate} onChange={(event) => setPurchasedDate(event.target.value)} />
                </label>
                <label className="field">Storage
                  <select value={storage} onChange={(event) => setStorage(event.target.value)}>
                    <option value="fridge">Fridge</option>
                    <option value="ambient">Out of fridge</option>
                    {selected.canFreeze && <option value="freezer">Freezer</option>}
                  </select>
                </label>
                <label className="field">Packaging expiration (optional)
                  <input type="date" min={purchasedDate} value={packagingDate} onChange={(event) => setPackagingDate(event.target.value)} />
                </label>
              </div>
              {purchase.isError && <p role="alert" className="form-error">{purchase.error.message}</p>}
            </>
          )}
          <div className="form-actions">
            <Button variant="text" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={!selected || purchase.isPending}>Save purchase</Button>
          </div>
        </form>
      )}

      <div className="catalog-heading"><h2>On hand</h2><span>{lots.length} on hand</span></div>
      {inventory.isPending && <p className="catalog-state" role="status">Loading your shelf…</p>}
      {inventory.isError && (
        <div className="catalog-state" role="alert">
          <p>{inventory.error.message}</p>
          <Button onClick={() => inventory.refetch()}>Try again</Button>
        </div>
      )}
      {inventory.isSuccess && lots.length === 0 && (
        <div className="catalog-empty">
          <Inventory2RoundedIcon />
          <h3>Nothing on your shelf yet</h3>
          <p>Ingredients in the catalog are not food you own. Add a purchase to start tracking what you have.</p>
        </div>
      )}
      {inventory.isSuccess && lots.length > 0 && (
        <ul className="shelf-grid">{lots.map((lot) => <LotCard key={lot.id} lot={lot} />)}</ul>
      )}
    </section>
  );
}