export type TimeRange = "7D" | "1M" | "3M" | "6M" | "1Y" | "ALL" | "CUSTOM";

export const RANGES: { value: TimeRange; label: string }[] = [
  { value: "7D", label: "7 Days" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "CUSTOM", label: "Custom" },
  { value: "ALL", label: "All" },
];

/**
 * Get the cutoff date for a given time range relative to now.
 */
export function getTimeRangeCutoff(range: TimeRange): Date | null {
  if (range === "ALL") return null;
  const now = new Date();
  switch (range) {
    case "1M": return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3M": return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "6M": return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "1Y": return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
}

/**
 * Try to parse a value as a date. Handles:
 * - Unix epoch seconds (string or number, > 1e9)
 * - ISO date strings
 * - YYYY-MM-DD strings
 */
export function parseAsDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === "" || val === "N/A") return null;
  // Epoch seconds (Tenable style)
  if (typeof val === "number" && val > 1e9) return new Date(val * 1000);
  if (typeof val === "string") {
    const num = Number(val);
    if (!isNaN(num) && num > 1e9) return new Date(num * 1000);
    // Try date string parse
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Filter chart data by time range. Looks for date-like values in the "name" field
 * or common date fields in the raw data.
 */
export function filterByTimeRange<T extends Record<string, unknown>>(
  data: T[],
  range: TimeRange,
): T[] {
  if (range === "ALL" || !data.length) return data;
  const cutoff = getTimeRangeCutoff(range);
  if (!cutoff) return data;

  const filtered = data.filter((row) => {
    // Check the "name" field first (often holds the date label)
    const nameDate = parseAsDate(row.name);
    if (nameDate && nameDate >= cutoff) return true;

    // Check common date fields
    for (const field of ["date", "day", "timestamp", "firstSeen", "lastSeen"]) {
      if (field in row) {
        const d = parseAsDate(row[field]);
        if (d && d >= cutoff) return true;
      }
    }

    // If no date found, include the row
    return true;
  });

  return filtered;
}

/**
 * Check if chart data contains any date-parseable values (to decide whether to show time range selector).
 */
export function hasDateData(data: Record<string, unknown>[]): boolean {
  if (!data.length) return false;
  // Check first few rows
  for (let i = 0; i < Math.min(3, data.length); i++) {
    const row = data[i];
    if (parseAsDate(row.name)) return true;
    for (const field of ["date", "day", "timestamp", "firstSeen", "lastSeen"]) {
      if (field in row && parseAsDate(row[field])) return true;
    }
  }
  return false;
}
