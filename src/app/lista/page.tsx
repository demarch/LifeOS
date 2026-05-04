import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { ShoppingList } from '@/components/pages/lista/shopping-list';
import { Icon } from '@/components/atoms/icon';

export default function ListaPage() {
  const allItems = db.select().from(shoppingItems).orderBy(asc(shoppingItems.category)).all();
  const done = allItems.filter(i => i.isChecked).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lista de compras</h1>
          <div className="sub">
            {done}/{allItems.length} concluídos ·{' '}
            {allItems.filter(i => i.isRecurring).length} recorrentes
          </div>
        </div>
        <div className="right">
          <button className="btn ghost">
            <Icon name="trash" size={14} /> Limpar marcados
          </button>
        </div>
      </div>

      <ShoppingList initialItems={allItems} />
    </>
  );
}
