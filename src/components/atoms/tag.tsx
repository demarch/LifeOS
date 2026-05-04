import type React from 'react';
import { Icon } from './icon';

type Tone = 'default' | 'accent' | 'good' | 'warn' | 'danger' | 'info';

interface TagProps {
  tone?: Tone;
  icon?: string;
  children: React.ReactNode;
}

export function Tag({ tone = 'default', icon, children }: TagProps) {
  return (
    <span className={`tag${tone !== 'default' ? ` ${tone}` : ''}`}>
      {icon && <Icon name={icon} size={10} />}
      {children}
    </span>
  );
}
