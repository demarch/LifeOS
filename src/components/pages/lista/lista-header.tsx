'use client';
import { useRef } from 'react';
import { Icon } from '@/components/atoms/icon';
import { ShoppingList } from './shopping-list';
import type { ShoppingItem } from '@/db/schema';

interface ListaHeaderProps {
  initialItems: ShoppingItem[];
  done: number;
  total: number;
  recurring: number;
}

export function ListaShell({ initialItems, done, total, recurring }: ListaHeaderProps) {
  const closeRef = useRef<(() => void) | null>(null);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista de compras</h1>
          <div className="sub">
            {done}/{total} concluídos · {recurring} recorrentes
          </div>
        </div>
        <div className="right">
          <button className="btn ghost" onClick={() => closeRef.current?.()}>
            <Icon name="trash" size={14} /> Limpar marcados
          </button>
        </div>
      </div>
      <div className="lista-tabs">
        <a href="/lista" className="tab active">Lista</a>
        <a href="/lista/base" className="tab">Base</a>
        <a href="/lista/historico" className="tab">Histórico</a>
      </div>
      <ShoppingList
        initialItems={initialItems}
        onCloseSessionRef={fn => { closeRef.current = fn; }}
      />
    </>
  );
}
