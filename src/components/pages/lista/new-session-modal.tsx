'use client';

interface NewSessionModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function NewSessionModal({ onConfirm, onCancel }: NewSessionModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Iniciar nova compra?</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-2)', fontSize: 13 }}>
          Os itens da sua lista base serão adicionados à lista atual.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onCancel}>Não</button>
          <button className="btn primary" onClick={onConfirm}>Sim</button>
        </div>
      </div>
    </div>
  );
}
