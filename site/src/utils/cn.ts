import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges conflicting Tailwind CSS class names with clsx conditionally resolved values. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
