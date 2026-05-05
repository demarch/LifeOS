import { db } from '@/db/client';
import { shoppingSessions, shoppingSessionItems } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Historico } from '@/components/pages/lista/historico';
import { buildFrequencyRanking } from '@/lib/shopping-frequency';
import type { ShoppingSessionItem } from '@/db/schema';

export default function HistoricoPage() {
  const sessions = db.select().from(shoppingSessions)
    .orderBy(desc(shoppingSessions.completedAt)).all();

  const allSessionItems = db.select().from(shoppingSessionItems).all();

  // Group session items by sessionId for O(1) lookup in client component
  const sessionItemsMap: Record<string, ShoppingSessionItem[]> = {};
  for (const item of allSessionItems) {
    if (!sessionItemsMap[item.sessionId]) sessionItemsMap[item.sessionId] = [];
    sessionItemsMap[item.sessionId].push(item);
  }

  // Build frequency ranking server-side using pure fn
  const sessionMap = new Map(sessions.map(s => [s.id, s.completedAt]));
  const rows = allSessionItems.map(i => ({
    name: i.name,
    category: i.category,
    completedAt: sessionMap.get(i.sessionId) ?? 0,
  }));
  const frequency = buildFrequencyRanking(rows);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Histórico</h1>
          <div className="sub">{sessions.length} compras finalizadas</div>
        </div>
      </div>
      <div className="lista-tabs">
        <a href="/lista" className="tab">Lista</a>
        <a href="/lista/base" className="tab">Base</a>
        <a href="/lista/historico" className="tab active">Histórico</a>
      </div>
      <Historico
        sessions={sessions}
        frequency={frequency}
        sessionItemsMap={sessionItemsMap}
      />
    </>
  );
}
