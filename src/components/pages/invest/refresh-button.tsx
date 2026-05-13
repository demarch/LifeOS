'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showToast } from '@/lib/toast';

export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/invest/refresh', { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        const msg = body.error ?? 'falha desconhecida';
        const code = body.code ?? 'ERROR';
        showToast(`Erro (${code}): ${msg}`, 'error', 6000);
        return;
      }
      const w = body.warnings?.length ? ` (${body.warnings.length} avisos)` : '';
      showToast(`Atualizado: ${body.syncedPositions} posições, ${body.refreshedQuotes} cotações${w}`, 'success');
      router.refresh();
    } catch (err) {
      showToast(`Erro de rede: ${err instanceof Error ? err.message : String(err)}`, 'error', 6000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} style={{
      padding: '8px 14px',
      borderRadius: 8,
      background: 'var(--accent)',
      color: '#0b0f14',
      border: 'none',
      fontSize: 13,
      fontWeight: 600,
      cursor: loading ? 'wait' : 'pointer',
      opacity: loading ? 0.6 : 1,
    }}>
      {loading ? 'Atualizando…' : 'Atualizar'}
    </button>
  );
}
