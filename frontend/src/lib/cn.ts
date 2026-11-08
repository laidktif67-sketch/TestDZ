/**
 * Join conditional CSS class names.
 * Keeps the UI components dependency-free.
 */
type ClassNameValue = string | number | false | null | undefined;

export function cn(...values: ClassNameValue[]): string {
  return values
    .filter((value): value is string | number => Boolean(value))
    .join(" ");
}
