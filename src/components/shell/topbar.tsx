'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/atoms/icon';
import { useSettings } from '@/lib/settings';

const TITLES: Record<string, string> = {
  '/':             'Início',
  '/financas':     'Finanças',
  '/contas':       'Contas a pagar',
  '/assinaturas':  'Assinaturas',
  '/lista':        'Lista',
};

export function Topbar() {
  const pathname = usePathname();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState('—');
  const { settings, update } = useSettings();

  const title = TITLES[pathname] ?? 'Life OS';

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLastSync(`Hoje, ${now}`);
    } catch {
      // sync_log captures details
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="top">
      <div className="crumbs">
        <span>Life OS</span>
        <span className="sep"><Icon name="chevron" size={12} /></span>
        <span className="here">{title}</span>
      </div>
      <div className="spacer" />

      <div className={`sync-strip${syncing ? ' syncing' : ''}`}>
        <span className="pulse" />
        {syncing
          ? 'Sincronizando…'
          : <span>sincronizado · <span style={{ color: 'var(--text-3)' }}>{lastSync}</span></span>
        }
      </div>

      <div className="search">
        <Icon name="search" size={14} color="var(--text-3)" />
        <input placeholder="Buscar transação, conta…" readOnly />
        <kbd>⌘K</kbd>
      </div>

      <button
        className="priv"
        onClick={() => update('privacy', !settings.privacy)}
        title="Modo privado"
      >
        <Icon name={settings.privacy ? 'eyeOff' : 'eye'} size={16} />
      </button>

      <button className="btn" title="Notificações">
        <Icon name="bell" size={15} />
      </button>

      <button className="btn primary" onClick={handleSync} disabled={syncing}>
        <Icon name="sync" size={14} color="#14112b" />
        {syncing ? 'Sincronizando' : 'Sincronizar'}
      </button>
    </div>
  );
}
