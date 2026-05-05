'use client';
import { useState } from 'react';
import type { ShoppingSession, ShoppingSessionItem } from '@/db/schema';
import type { FrequencyEntry } from '@/lib/shopping-frequency';

interface HistoricoProps {
  sessions: ShoppingSession[];
  frequency: FrequencyEntry[];
  sessionItemsMap: Record<string, ShoppingSessionItem[]>;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function formatDaysAgo(ts: number): string {
  const days = Math.floor((Date.now() / 1000 - ts) / 86400);
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  return `${days} dias atrás`;
}

export function Historico({ sessions, frequency, sessionItemsMap }: HistoricoProps) {
  const [tab, setTab] = useState<'sessions' | 'frequency'>('sessions');
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`btn${tab === 'sessions' ? ' primary' : ' ghost'}`}
          onClick={() => setTab('sessions')}
        >
          Sessões
        </button>
        <button
          className={`btn${tab === 'frequency' ? ' primary' : ' ghost'}`}
          onClick={() => setTab('frequency')}
        >
          Por item
        </button>
      </div>

      {tab === 'sessions' && (
        <>
          {sessions.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
              Nenhuma compra finalizada ainda.
            </div>
          )}
          {sessions.map(session => {
            const isOpen = expanded === session.id;
            const sItems = sessionItemsMap[session.id] ?? [];
            return (
              <div key={session.id} className="hist-session">
                <div className="hist-head" onClick={() => setExpanded(isOpen ? null : session.id)}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{formatDate(session.completedAt)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {session.totalChecked} de {session.totalItems} itens comprados
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-3)', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="hist-body">
                    {sItems.map(item => (
                      <div key={item.id} className="hist-item">
                        <span style={{ flex: 1 }}>{item.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                          ×{item.qty}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>
                          {item.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {tab === 'frequency' && (
        <>
          {frequency.length === 0 && (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
              Nenhum dado de frequência ainda.
            </div>
          )}
          {frequency.map((entry, i) => (
            <div key={entry.name} className="freq-item">
              <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12, width: 24 }}>
                {i + 1}
              </span>
              <span className="freq-name">{entry.name}</span>
              <span className="freq-last">{formatDaysAgo(entry.lastBoughtAt)}</span>
              <span className="freq-count">{entry.count}×</span>
            </div>
          ))}
        </>
      )}
    </>
  );
}
