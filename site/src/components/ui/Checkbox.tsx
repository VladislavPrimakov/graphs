import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import type React from 'react';
import { CheckIcon } from '@/components/icons';
import { cn } from '@/utils/cn';

/** Checkbox primitive wrapping Radix Checkbox with custom dark-glass and accent styling. */
export const Checkbox: React.FC<React.ComponentProps<typeof CheckboxPrimitive.Root>> = ({ className, ...props }) => (
  <CheckboxPrimitive.Root
    className={cn(
      'peer flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-border-subtle bg-surface-base transition-colors',
      'hover:border-accent-primary/60 hover:bg-surface-elevated',
      'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-primary/40',
      'data-[state=checked]:bg-accent-primary data-[state=checked]:border-accent-primary data-[state=checked]:text-white',
      'disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <CheckIcon className="h-3 w-3 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
