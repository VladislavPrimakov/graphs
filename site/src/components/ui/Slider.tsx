import * as SliderPrimitive from '@radix-ui/react-slider';
import type React from 'react';
import { cn } from '@/utils/cn';

const thumbClassName =
  'block h-3.5 w-3.5 rounded-full border border-accent-primary/50 bg-accent-primary shadow-xs transition-transform hover:scale-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent-primary/40 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing';

/** Slider primitive wrapping Radix Slider with custom dark-glass and accent styling. Supports single and dual thumbs. */
export const Slider: React.FC<React.ComponentProps<typeof SliderPrimitive.Root>> = ({ className, ...props }) => {
  const count = Array.isArray(props.value) ? props.value.length : Array.isArray(props.defaultValue) ? props.defaultValue.length : 1;

  return (
    <SliderPrimitive.Root className={cn('relative flex w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-base border border-border-subtle/60">
        <SliderPrimitive.Range className="absolute h-full bg-accent-primary" />
      </SliderPrimitive.Track>
      {count > 1 ? (
        <>
          <SliderPrimitive.Thumb className={thumbClassName} />
          <SliderPrimitive.Thumb className={thumbClassName} />
        </>
      ) : (
        <SliderPrimitive.Thumb className={thumbClassName} />
      )}
    </SliderPrimitive.Root>
  );
};
