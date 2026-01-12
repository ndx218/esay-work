// UI card component// components/ui/card.tsx

import React, { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className = '', ...props }: CardProps) => (
  <div
    className={cn(`border rounded shadow-sm bg-white ${className}`)}
    {...props}
  >
    {children}
  </div>
);
