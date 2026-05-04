'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import type { ShoppingItem } from '@/db/schema';

interface ShoppingListProps {
  initialItems: ShoppingItem[];
}

const CATEGORIES = ['Hortifruti', 'Mercado', 'Limpeza', 'Outros'];

export function ShoppingList({ initialItems }: ShoppingListProps) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('Mercado');

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

  const addItem = async () => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: draftCat, isRecurring: false }),
    });
    const { id } = await res.json();
    setItems(xs => [...xs, {
      id, name, category: draftCat, isRecurring: 0, isChecked: 0,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
    setDraft('');
  };

  const clearChecked = async () => {
    const checked = items.filter(i => i.isChecked);
    await Promise.all(checked.map(i =>
      fetch(`/api/shopping/${i.id}`, { method: 'DELETE' })
    ));
    setItems(xs => xs.filter(x => !x.isChecked));
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
                  onClick={() => toggle(item)}
                >
                  <span className="check">
                    {item.isChecked && <Icon name="check" size={12} color="#14112b" />}
                  </span>
                  <span className="label">{item.name}</span>
                  {!!item.isRecurring && <span className="recur">↻ recorrente</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
          Lista vazia — adicione itens acima.
        </div>
      )}
    </>
  );
}
