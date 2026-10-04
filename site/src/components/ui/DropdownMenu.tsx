import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type React from 'react';
import { cn } from '@/utils/cn';

/** Root dropdown menu coordinating toggle state, focus management, and keyboard navigation. */
export const DropdownMenu = DropdownMenuPrimitive.Root;

/** Trigger button toggling visibility of the dropdown menu content. */
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

/** Floating menu container styled with dark glassmorphic blur and entrance animations. */
export const DropdownMenuContent: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Content>> = ({ className, sideOffset = 6, ...props }) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-36 overflow-hidden glass-overlay py-1 shadow-xl',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);

/** Interactive menu item supporting keyboard selection and hover highlights. */
export const DropdownMenuItem: React.FC<React.ComponentProps<typeof DropdownMenuPrimitive.Item>> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2.5 px-3 py-2 text-xs font-medium outline-hidden transition-colors',
      'text-content-secondary hover:text-content-primary hover:bg-surface-elevated/70 focus:bg-surface-elevated/70 focus:text-content-primary',
      'data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  />
);
