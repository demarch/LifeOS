import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { ListaShell } from '@/components/pages/lista/lista-header';

export default function ListaPage() {
  const allItems = db.select().from(shoppingItems).orderBy(asc(shoppingItems.category)).all();
  const done = allItems.filter(i => i.isChecked).length;
  const recurring = allItems.filter(i => i.isRecurring).length;

  return (
    <ListaShell
      initialItems={allItems}
      done={done}
      total={allItems.length}
      recurring={recurring}
    />
  );
}
