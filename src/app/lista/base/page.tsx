import { db } from '@/db/client';
import { baseListItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { BaseList } from '@/components/pages/lista/base-list';

export default function BaseListPage() {
  const items = db.select().from(baseListItems).orderBy(asc(baseListItems.category)).all();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista base</h1>
          <div className="sub">{items.length} itens recorrentes</div>
        </div>
      </div>
      <div className="lista-tabs">
        <a href="/lista" className="tab">Lista</a>
        <a href="/lista/base" className="tab active">Base</a>
        <a href="/lista/historico" className="tab">Histórico</a>
      </div>
      <BaseList initialItems={items} />
    </>
  );
}
