'use client';
import { useState } from 'react';
import { Icon } from '@/components/atoms/icon';
import { Tag } from '@/components/atoms/tag';
import { fmt } from '@/lib/fmt';
import type { Subscription } from '@/db/schema';

const LOGOS: Record<string, { bg: string; glyph: string }> = {
  'Netflix':         { bg: '#E50914', glyph: 'N' },
  'Spotify':         { bg: '#1ED760', glyph: '♪' },
  'Disney+':         { bg: '#1B3D6B', glyph: 'D+' },
  'ChatGPT Plus':    { bg: '#10A37F', glyph: 'GPT' },
  'Cursor Pro':      { bg: '#222',    glyph: '⌘' },
  'iCloud':          { bg: '#3FA5F5', glyph: '☁' },
  'Notion':          { bg: '#fff',    glyph: 'N' },
  'Amazon Prime':    { bg: '#00A8E1', glyph: 'a' },
  'YouTube Premium': { bg: '#FF0000', glyph: '▶' },
  'GitHub':          { bg: '#24292f', glyph: '⊙' },
  'Claude':          { bg: '#D97757', glyph: 'C' },
};

interface SubsPageProps {
  initialSubs: Subscription[];
}

export function SubsPage({ initialSubs }: SubsPageProps) {
  const [subs, setSubs] = useState(initialSubs);
  const [catFilter, setCatFilter] = useState('all');

  const cats = ['all', ...Array.from(new Set(subs.map(s => s.category)))];
  const filtered = catFilter === 'all' ? subs : subs.filter(s => s.category === catFilter);
  const active = subs.filter(s => s.isActive);
  const totalMonth = active.reduce((s, x) => s + x.amount, 0);

  const streamingTotal = active.filter(s => s.category === 'Streaming').reduce((s, x) => s + x.amount, 0);
  const aiTotal = active.filter(s => s.category === 'IA').reduce((s, x) => s + x.amount, 0);

  const nextSub = [...active].sort((a, b) => {
    const today = new Date().getDate();
    const da = a.billingDay >= today ? a.billingDay - today : 31 - today + a.billingDay;
    const db2 = b.billingDay >= today ? b.billingDay - today : 31 - today + b.billingDay;
    return da - db2;
  })[0];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <div className="card">
          <h3>Total mensal</h3>
          <div className="num accent mask">{fmt(totalMonth)}</div>
          <div className="meta">{active.length} serviços ativos</div>
        </div>
        <div className="card">
          <h3>Streaming</h3>
          <div className="num mask">{fmt(streamingTotal)}</div>
          <div className="meta">{active.filter(s => s.category === 'Streaming').length} assinaturas</div>
        </div>
        <div className="card">
          <h3>IA & Dev</h3>
          <div className="num mask">{fmt(aiTotal)}</div>
          <div className="meta">{active.filter(s => s.category === 'IA').length} assinaturas</div>
        </div>
        <div className="card">
          <h3>Próxima cobrança</h3>
          {nextSub
            ? <><div className="num warn">dia {nextSub.billingDay}</div><div className="meta">{nextSub.name} · {fmt(nextSub.amount)}</div></>
            : <div className="num" style={{ color: 'var(--text-3)' }}>—</div>
          }
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {cats.map(c => (
          <span key={c} className={`chip${catFilter === c ? ' on' : ''}`} onClick={() => setCatFilter(c)}>
            {c === 'all' ? 'Todas' : c}
          </span>
        ))}
      </div>

      <div className="subs-grid">
        {filtered.length === 0 && (
          <div style={{ color: 'var(--text-3)', fontSize: 13, gridColumn: '1/-1' }}>
            Nenhuma assinatura encontrada.
          </div>
        )}
        {filtered.map(s => {
          const logo = LOGOS[s.name] ?? { bg: 'var(--accent)', glyph: s.name[0] };
          return (
            <div key={s.id} className={`sub-card${!s.isActive ? ' inactive' : ''}`}>
              <div className="head">
                <div
                  className="logo"
                  style={{ background: logo.bg, color: logo.bg === '#fff' ? '#000' : '#fff' }}
                >
                  {logo.glyph}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="name">{s.name}</div>
                  <div className="cat">{s.category}{s.source === 'auto' ? ' · auto' : ''}</div>
                </div>
                <button className="btn ghost icon"><Icon name="edit" size={14} /></button>
              </div>
              <div className="price-row">
                <span className="price mask">{fmt(s.amount)}</span>
                <span className="per">/mês</span>
              </div>
              <div className="next">
                <Icon name="calendar" size={12} color="var(--text-3)" />
                Próx. cobrança dia <b style={{ color: 'var(--text-1)' }}>{s.billingDay}</b>
                {s.alertDays > 0 && <Tag>alerta {s.alertDays}d antes</Tag>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
