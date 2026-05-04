interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 16, color = 'currentColor' }: IconProps) {
  const s = { stroke: color, fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  const paths: Record<string, React.ReactNode> = {
    home:      <><path d="M3 10.5L12 3l9 7.5" {...s} /><path d="M5 9.5V20h14V9.5" {...s} /></>,
    wallet:    <><rect x="3" y="6" width="18" height="13" rx="2" {...s} /><path d="M3 10h18" {...s} /><circle cx="17" cy="14.5" r="1.2" fill={color} /></>,
    calendar:  <><rect x="3" y="5" width="18" height="16" rx="2" {...s} /><path d="M3 9h18M8 3v4M16 3v4" {...s} /></>,
    repeat:    <><path d="M4 9V7a2 2 0 0 1 2-2h11l-2-2M20 15v2a2 2 0 0 1-2 2H7l2 2" {...s} /></>,
    cart:      <><path d="M3 4h2l2.4 11.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.6L21 8H6" {...s} /><circle cx="9" cy="20" r="1.2" {...s} /><circle cx="17" cy="20" r="1.2" {...s} /></>,
    sync:      <><path d="M4 12a8 8 0 0 1 13.5-5.5L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.5 5.5L4 15M4 20v-5h5" {...s} /></>,
    plus:      <><path d="M12 5v14M5 12h14" {...s} /></>,
    search:    <><circle cx="11" cy="11" r="6" {...s} /><path d="M16 16l4 4" {...s} /></>,
    bell:      <><path d="M6 16h12l-1.5-2v-4a4.5 4.5 0 0 0-9 0v4L6 16z" {...s} /><path d="M10 19a2 2 0 0 0 4 0" {...s} /></>,
    eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" {...s} /><circle cx="12" cy="12" r="3" {...s} /></>,
    eyeOff:    <><path d="M3 3l18 18" {...s} /><path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6s-1 1.7-3 3.4M6.5 7.5C3.7 9.4 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8" {...s} /></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7" {...s} /></>,
    arrowUp:   <><path d="M12 19V5M5 12l7-7 7 7" {...s} /></>,
    check:     <><path d="M5 12l5 5 9-11" {...s} /></>,
    filter:    <><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" {...s} /></>,
    chevron:   <><path d="M9 6l6 6-6 6" {...s} /></>,
    edit:      <><path d="M4 20h4l10-10-4-4L4 16v4z" {...s} /><path d="M14 6l4 4" {...s} /></>,
    trash:     <><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" {...s} /></>,
    bot:       <><rect x="4" y="8" width="16" height="11" rx="2" {...s} /><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6" {...s} /></>,
    download:  <><path d="M12 4v12M6 12l6 6 6-6M4 20h16" {...s} /></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
}
