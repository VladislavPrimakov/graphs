import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import type React from 'react';
import { cn } from '@/utils/cn';

/** Segmented group container coordinating single or multiple option selection. */
export const ToggleGroup: React.FC<React.ComponentProps<typeof ToggleGroupPrimitive.Root>> = ({ className, children, ...props }) => (
  <ToggleGroupPrimitive.Root className={cn('inline-flex items-center gap-1 p-1 control-panel', className)} {...props}>
    {children}
  </ToggleGroupPrimitive.Root>
);

/** Individual toggle button item within a ToggleGroup. */
export const ToggleGroupItem: React.FC<React.ComponentProps<typeof ToggleGroupPrimitive.Item>> = ({ className, children, ...props }) => (
  <ToggleGroupPrimitive.Item
    className={cn(
      'px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer select-none outline-hidden focus-visible:ring-1 focus-visible:ring-accent-primary/50 border border-transparent',
      'text-content-muted hover:text-content-primary hover:bg-surface-elevated/50',
      'data-[state=on]:bg-accent-glow data-[state=on]:text-accent-primary data-[state=on]:border-accent-primary/40 data-[state=on]:shadow-xs',
      className,
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
);
