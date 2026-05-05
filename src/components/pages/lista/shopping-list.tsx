'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { NewSessionModal } from './new-session-modal';
import type { ShoppingItem } from '@/db/schema';

interface ShoppingListProps {
  initialItems: ShoppingItem[];
  onCloseSessionRef?: (fn: () => void) => void;
}

const CATEGORIES = ['Hortifruti', 'Mercado', 'Limpeza', 'Outros'];

export function ShoppingList({ initialItems, onCloseSessionRef }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('Mercado');
  const [draftQty, setDraftQty] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const total = items.length;
  const done = items.filter(i => i.isChecked).length;
  const cats = Array.from(new Set(items.map(i => i.category)));

  const toggle = async (item: ShoppingItem) => {
    const next = !item.isChecked;
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isChecked: next }),
    });
    setItems(xs => xs.map(x => x.id === item.id ? { ...x, isChecked: next ? 1 : 0 } : x));
  };

  const updateQty = async (item: ShoppingItem, qty: number) => {
    if (qty < 1) return;
    await fetch(`/api/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    });
    setItems(xs => xs.map(x => x.id === item.id ? { ...x, qty } : x));
  };

  const addItem = async () => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: draftCat, qty: draftQty, isRecurring: false }),
    });
    const { id } = await res.json();
    setItems(xs => [...xs, {
      id, name, category: draftCat, qty: draftQty,
      isRecurring: 0, isChecked: 0,
      baseListItemId: null,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
    setDraft('');
    setDraftQty(1);
  };

  const closeSession = async () => {
    const checkedCount = items.filter(i => i.isChecked).length;
    if (checkedCount === 0) return;
    await fetch('/api/shopping/sessions', { method: 'POST' });
    setItems(xs => xs.filter(x => !x.isChecked));
    setShowModal(true);
  };

  if (onCloseSessionRef) onCloseSessionRef(closeSession);

  const onStartNewTrip = async () => {
    setShowModal(false);
    const res = await fetch('/api/shopping/from-base', { method: 'POST' });
    const { added } = await res.json() as { added: string[] };
    if (added.length > 0) {
      const listRes = await fetch('/api/shopping');
      const all = await listRes.json() as ShoppingItem[];
      setItems(all);
    }
  };

  const allCats = Array.from(new Set([...cats, ...CATEGORIES]));

  return (
    <>
      <div className="new-input">
        <Icon name="plus" size={16} color="var(--accent)" />
        <input
          placeholder="Adicionar item à lista…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
        />
        <div className="qty-ctrl">
          <button type="button" onClick={() => setDraftQty(q => Math.max(1, q - 1))}>−</button>
          <span>{draftQty}</span>
          <button type="button" onClick={() => setDraftQty(q => q + 1)}>+</button>
        </div>
        <select
          value={draftCat}
          onChange={e => setDraftCat(e.target.value)}
          style={{
            background: 'var(--bg-3)', color: 'var(--text-1)',
            border: '1px solid var(--line)', borderRadius: 6,
            padding: '4px 8px', fontSize: 12,
          }}
        >
          {allCats.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn primary" onClick={addItem}>Adicionar</button>
      </div>

      {total > 0 && (
        <div className="bar" style={{ marginBottom: 18 }}>
          <span style={{ width: `${(done / total) * 100}%`, background: 'var(--accent)' }} />
        </div>
      )}

      {allCats.map(cat => {
        const list = items.filter(i => i.category === cat);
        if (list.length === 0) return null;
        const ck = list.filter(i => i.isChecked).length;
        return (
          <div key={cat} className="shop-section">
            <div className="head">
              <span>{cat}</span>
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {ck}/{list.length}
              </span>
            </div>
            <div>
              {list.map(item => (
                <div
                  key={item.id}
                  className={`shop-item${item.isChecked ? ' checked' : ''}`}
                >
                  <span className="check" onClick={() => toggle(item)}>
                    {item.isChecked && <Icon name="check" size={12} color="#14112b" />}
                  </span>
                  <span className="label" onClick={() => toggle(item)}>{item.name}</span>
                  {!!item.isRecurring && <span className="recur">↻ recorrente</span>}
                  <div className="qty-ctrl" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => updateQty(item, (item.qty ?? 1) - 1)}>−</button>
                    <span>{item.qty ?? 1}</span>
                    <button type="button" onClick={() => updateQty(item, (item.qty ?? 1) + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
          Lista vazia — adicione itens acima ou{' '}
          <a href="/lista/base" style={{ color: 'var(--accent)' }}>configure a lista base</a>.
        </div>
      )}

      {showModal && (
        <NewSessionModal
          onConfirm={onStartNewTrip}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  );
}
