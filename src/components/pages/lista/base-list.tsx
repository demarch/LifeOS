'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import type { BaseListItem } from '@/db/schema';

interface BaseListProps {
  initialItems: BaseListItem[];
}

const CATEGORIES = ['Hortifruti', 'Mercado', 'Limpeza', 'Outros'];

export function BaseList({ initialItems }: BaseListProps) {
  const [items, setItems] = useState(initialItems);
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState('Mercado');
  const [draftQty, setDraftQty] = useState(1);

  const addItem = async () => {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch('/api/shopping/base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: draftCat, defaultQty: draftQty }),
    });
    const { id } = await res.json();
    setItems(xs => [...xs, {
      id, name, category: draftCat, defaultQty: draftQty,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
    setDraft('');
    setDraftQty(1);
  };

  const removeItem = async (id: string) => {
    await fetch(`/api/shopping/base/${id}`, { method: 'DELETE' });
    setItems(xs => xs.filter(x => x.id !== id));
  };

  const addToActive = async (item: BaseListItem) => {
    await fetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: item.name, category: item.category,
        qty: item.defaultQty, baseListItemId: item.id,
      }),
    });
  };

  return (
    <>
      <div className="new-input">
        <Icon name="plus" size={16} color="var(--accent)" />
        <input
          placeholder="Adicionar à lista base…"
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
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn primary" onClick={addItem}>Adicionar</button>
      </div>

      {items.length === 0 && (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
          Lista base vazia — adicione itens recorrentes acima.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {items.map(item => (
          <div key={item.id} className="base-item">
            <span className="base-name">{item.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-2)' }}>
              ×{item.defaultQty}
            </span>
            <span className="base-cat">{item.category}</span>
            <div className="base-actions">
              <button
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: 12 }}
                onClick={() => addToActive(item)}
                title="Adicionar à lista atual"
              >
                + lista
              </button>
              <button
                className="btn ghost"
                style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)' }}
                onClick={() => removeItem(item.id)}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
