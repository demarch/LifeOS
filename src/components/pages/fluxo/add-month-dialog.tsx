'use client';
import { useState } from 'react';

interface AddMonthDialogProps {
  onConfirm: (args: { key: string; openingBalance: number; inheritOpening: number; autoSeed: boolean }) => void | Promise<void>;
  onCancel: () => void;
  defaultKey?: string;
}

export function AddMonthDialog({ onConfirm, onCancel, defaultKey }: AddMonthDialogProps) {
  const today = new Date();
  const fallback = defaultKey ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [key, setKey] = useState(fallback);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [inheritOpening, setInheritOpening] = useState(true);
  const [autoSeed, setAutoSeed] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({
        key,
        openingBalance: parseFloat(openingBalance) || 0,
        inheritOpening: inheritOpening ? 1 : 0,
        autoSeed,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fluxo-modal-backdrop" onClick={onCancel}>
      <div className="fluxo-modal" onClick={e => e.stopPropagation()}>
        <h3>Adicionar novo mês</h3>

        <div className="row">
          <label>Mês e ano</label>
          <input type="month" value={key} onChange={e => setKey(e.target.value)} />
        </div>

        <label className="check-row">
          <input type="checkbox" checked={inheritOpening} onChange={e => setInheritOpening(e.target.checked)} />
          Herdar saldo final do mês anterior
        </label>

        {!inheritOpening && (
          <div className="row">
            <label>Saldo inicial (R$)</label>
            <input type="number" step="0.01" placeholder="0,00" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} />
          </div>
        )}

        <label className="check-row">
          <input type="checkbox" checked={autoSeed} onChange={e => setAutoSeed(e.target.checked)} />
          Auto-popular de assinaturas e contas
        </label>

        <div className="actions">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="btn primary" onClick={submit} disabled={busy || !key}>
            {busy ? 'Criando…' : 'Criar mês'}
          </button>
        </div>
      </div>
    </div>
  );
}
