const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const REPEATED_DASHES = /-{2,}/g;

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(REPEATED_DASHES, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
