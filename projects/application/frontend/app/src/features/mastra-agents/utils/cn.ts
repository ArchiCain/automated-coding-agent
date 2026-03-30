/**
 * Minimal className utility for conditional classes
 * Temporary bridge during MUI migration
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
