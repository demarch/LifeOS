'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/atoms/icon';

const NAV = [
  { href: '/',             label: 'Início',       icon: 'home'     },
  { href: '/financas',     label: 'Finanças',     icon: 'wallet'   },
  { href: '/fluxo',        label: 'Fluxo',        icon: 'trending' },
  { href: '/contas',       label: 'Contas',       icon: 'calendar' },
  { href: '/assinaturas',  label: 'Assinaturas',  icon: 'repeat'   },
  { href: '/lista',        label: 'Lista',        icon: 'cart'     },
];

interface SidebarProps {
  lastSync?: string;
}

export function Sidebar({ lastSync = '—' }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="side">
      <div className="brand">
        <div className="brand-mark">L</div>
        <div>
          <div className="brand-name">Life OS</div>
          <div className="brand-sub">v0.1 · local</div>
        </div>
      </div>

      <div className="nav-label">Workspace</div>

      {NAV.map(item => {
        const active = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${active ? ' active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <span className="ic"><Icon name={item.icon} size={17} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="side-foot">
        <div className="row">
          <span className="dot" />
          SQLite ok
        </div>
        <div className="row" style={{ color: 'var(--text-2)' }}>
          Última sync: {lastSync}
        </div>
      </div>
    </aside>
  );
}
