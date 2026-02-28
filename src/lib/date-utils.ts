/**
 * Utility for converting epoch timestamps used by Tenable SC API.
 * Tenable returns Unix epoch seconds as strings (e.g. "1744728630").
 * Values of "-1" or "0" mean "N/A" / not set.
 */

/**
 * Known epoch fields in Tenable SC API responses.
 */
export const EPOCH_FIELDS = new Set([
  "firstSeen",
  "lastSeen",
  "vulnPubDate",
  "patchPubDate",
  "pluginPubDate",
  "pluginModDate",
  "seolDate",
]);

/**
 * Check if a field name is a known epoch timestamp field.
 */
export function isEpochField(fieldName: string): boolean {
  return EPOCH_FIELDS.has(fieldName);
}

/**
 * Convert an epoch seconds value (string or number) to a human-readable date string.
 * Returns "N/A" for -1, 0, or invalid values.
 */
export function epochToDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num) || num <= 0) return "N/A";

  const date = new Date(num * 1000);
  // Format as YYYY-MM-DD HH:mm
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

/**
 * Convert a short epoch to just a date (no time).
 */
export function epochToShortDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num) || num <= 0) return "N/A";
  const date = new Date(num * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Process a data row and convert all epoch fields to readable dates in-place.
 * Returns a new object with converted values.
 */
export function convertEpochFields(row: Record<string, any>): Record<string, any> {
  const result = { ...row };
  for (const field of EPOCH_FIELDS) {
    if (field in result) {
      result[field] = epochToDate(result[field]);
    }
  }
  return result;
}
