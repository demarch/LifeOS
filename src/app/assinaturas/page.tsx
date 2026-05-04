import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { SubsPage } from '@/components/pages/assinaturas/subs-page';

export default function AssinaturasPage() {
  const allSubs = db.select().from(subscriptions).orderBy(asc(subscriptions.billingDay)).all();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assinaturas</h1>
          <div className="sub">
            {allSubs.filter(s => s.isActive).length} ativas
          </div>
        </div>
        <div className="right">
          <button className="btn">+ Nova assinatura</button>
        </div>
      </div>

      <SubsPage initialSubs={allSubs} />
    </>
  );
}
