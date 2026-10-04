import * as DialogPrimitive from '@radix-ui/react-dialog';
import type React from 'react';
import { CloseIcon } from '@/components/icons';
import { cn } from '@/utils/cn';

/** Root headless dialog component managing open state and accessibility for drawers and sheets. */
export const Sheet = DialogPrimitive.Root;

const SheetOverlay: React.FC<React.ComponentProps<typeof DialogPrimitive.Overlay>> = ({ className, ...props }) => (
  <DialogPrimitive.Overlay
    className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0', className)}
    {...props}
  />
);

/** Props for the SheetContent component. */
export interface SheetContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /** Screen edge from which the drawer slides in. @default 'right' */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const SIDE_STYLES: Record<NonNullable<SheetContentProps['side']>, string> = {
  top: 'inset-x-0 top-0 border-b border-border-subtle data-[state=closed]:-translate-y-full data-[state=open]:translate-y-0',
  bottom: 'inset-x-0 bottom-0 border-t border-border-subtle data-[state=closed]:translate-y-full data-[state=open]:translate-y-0',
  left: 'inset-y-0 left-0 h-full w-3/4 max-w-xs border-r border-border-subtle data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0',
  right: 'inset-y-0 right-0 h-full w-3/4 max-w-xs border-l border-border-subtle data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
};

/** Container element for drawer content, featuring glassmorphism and slide transitions. */
export const SheetContent: React.FC<SheetContentProps> = ({ side = 'right', className, children, ...props }) => (
  <DialogPrimitive.Portal>
    <SheetOverlay />
    <DialogPrimitive.Content
      className={cn('fixed z-50 flex flex-col bg-surface-card/95 backdrop-blur-xl p-6 shadow-2xl transition-transform duration-200 ease-in-out focus:outline-hidden', SIDE_STYLES[side], className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

/** Interactive close button for drawers and sheets. */
export const SheetClose: React.FC<React.ComponentProps<typeof DialogPrimitive.Close>> = ({ className, ...props }) => (
  <DialogPrimitive.Close
    className={cn(
      'rounded-md p-1.5 text-content-muted hover:text-content-primary hover:bg-surface-elevated transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent-primary cursor-pointer flex items-center justify-center',
      className,
    )}
    {...props}
  >
    <CloseIcon className="w-4 h-4" />
    <span className="sr-only">Close</span>
  </DialogPrimitive.Close>
);

/** Container for title and controls in sheet headers. */
export const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-between text-left mb-3', className)} {...props} />
);

/** Semantic heading title for accessibility inside sheet content. */
export const SheetTitle: React.FC<React.ComponentProps<typeof DialogPrimitive.Title>> = ({ className, ...props }) => (
  <DialogPrimitive.Title className={cn('text-xs font-bold text-content-muted uppercase tracking-wider leading-none', className)} {...props} />
);
