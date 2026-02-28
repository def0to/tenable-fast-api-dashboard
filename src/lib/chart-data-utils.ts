/**
 * Smart data utilities for auto-detecting the best fields to visualize
 * from any Tenable API response shape.
 */

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: "#7d1010", // Dark Red
  High: "#d21c1c",     // Bright Red
  Medium: "#ff9000",   // Orange
  Low: "#228b22",      // Green
  Info: "#2f8af9",     // Blue
  None: "hsl(215, 15%, 50%)",
};

export const CHART_COLORS = [
  "hsl(213, 94%, 58%)",
  "hsl(173, 80%, 40%)",
  "hsl(280, 65%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(152, 69%, 40%)",
  "hsl(45, 93%, 58%)",
  "hsl(330, 65%, 55%)",
];

/**
 * Given a data row, find the best "label" (name/category) field.
 */
function detectLabelField(row: Record<string, unknown>): string {
  // Priority order for label fields
  const labelCandidates = [
    "name", "pluginName", "ip", "dnsName", "port", "protocol",
    "cveID", "operatingSystem", "osCPE", "family", "severity",
    "customer", "status", "title", "label", "category", "type",
    "serviceName", "softwareCPE",
  ];

  for (const key of labelCandidates) {
    if (key in row) return key;
  }

  // Fall back to first string-valued field
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === "string" && isNaN(Number(val)) && key !== "id") return key;
    if (typeof val === "object" && val !== null && (val as any).name) return key;
  }

  return Object.keys(row)[0] || "name";
}

/**
 * Given a data row, find the best "value" (numeric) field.
 */
function detectValueField(row: Record<string, unknown>): string {
  const valueCandidates = [
    "count", "total", "score", "vprScore", "cvssV3BaseScore",
    "baseCVSSScore", "value", "size", "amount", "quantity",
    "severityCritical", "severityHigh",
  ];

  for (const key of valueCandidates) {
    if (key in row) return key;
  }

  // Fall back to first numeric-looking field
  for (const [key, val] of Object.entries(row)) {
    if (typeof val === "number") return key;
    if (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "") return key;
  }

  return "count";
}

/**
 * Extract a display string from a value that may be a string, object, or number
 */
export function extractLabel(val: unknown): string {
  if (val === null || val === undefined) return "Unknown";
  if (typeof val === "object") {
    const v = val as any;
    return v.name || v.id || JSON.stringify(val);
  }
  return String(val);
}

/**
 * Extract a numeric value from a field
 */
export function extractNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  if (typeof val === "object" && val !== null && (val as any).id) return parseInt((val as any).id) || 0;
  return 0;
}

export interface SmartChartData {
  chartData: { name: string; value: number; color?: string; [key: string]: unknown }[];
  labelKey: string;
  valueKey: string;
  valueKeys: string[];
}

/**
 * Pivot multi-source-type data into stacked series.
 * Each source type becomes a separate value key (e.g., "cumulative", "patched").
 */
function pivotBySourceType(
  data: Record<string, unknown>[],
  tool: string,
  xField?: string,
  yField?: string,
  maxItems: number = 20
): SmartChartData {
  // Group by source type
  const bySource: Record<string, Record<string, unknown>[]> = {};
  data.forEach(row => {
    const st = (row.__sourceType as string) || "unknown";
    if (!bySource[st]) bySource[st] = [];
    bySource[st].push(row);
  });

  const sourceTypes = Object.keys(bySource);

  // Transform each source type independently to get label→value maps
  const sourceMaps: Record<string, Map<string, number>> = {};
  sourceTypes.forEach(st => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stripped = bySource[st].map(({ __sourceType, ...rest }) => rest);
    const { chartData } = smartTransform(stripped, tool, xField, yField, maxItems);
    const map = new Map<string, number>();
    chartData.forEach(d => map.set(d.name, d.value));
    sourceMaps[st] = map;
  });

  // Collect all unique labels
  const allLabels = new Set<string>();
  Object.values(sourceMaps).forEach(m => m.forEach((_, k) => allLabels.add(k)));

  const chartData: SmartChartData["chartData"] = Array.from(allLabels).slice(0, maxItems).map(name => {
    const row: { name: string; value: number; [key: string]: unknown } = { name, value: 0 };
    sourceTypes.forEach(st => {
      const val = sourceMaps[st].get(name) || 0;
      row[st] = val;
      row.value += val;
    });
    return row;
  });

  return {
    chartData,
    labelKey: "name",
    valueKey: sourceTypes[0],
    valueKeys: sourceTypes,
  };
}

/**
 * Universal smart data transformer.
 * Auto-detects label/value fields or uses manual overrides.
 */
export function smartTransform(
  data: Record<string, unknown>[],
  tool: string,
  xField?: string,
  yField?: string,
  maxItems: number = 20
): SmartChartData {
  if (!data.length) return { chartData: [], labelKey: "name", valueKey: "value", valueKeys: ["value"] };

  // Check if data has __sourceType tags (multi-source comparison mode)
  const hasSourceTypes = data.some(r => "__sourceType" in r);
  if (hasSourceTypes) {
    return pivotBySourceType(data, tool, xField, yField, maxItems);
  }

  const sample = data[0];

  // If user specified both fields, use them directly
  if (xField && yField) {
    return {
      chartData: data.slice(0, maxItems).map(r => ({
        name: extractLabel(r[xField]),
        value: extractNumber(r[yField]),
        [yField]: extractNumber(r[yField]),
      })),
      labelKey: "name",
      valueKey: yField,
      valueKeys: [yField],
    };
  }

  // Tool-specific transforms for known shapes
  switch (tool) {
    case "sumseverity":
      return {
        chartData: data.map(r => {
          const sevName = (r.severity as any)?.name || "Unknown";
          return {
            name: sevName,
            value: parseInt((r.count as string) || "0"),
            count: parseInt((r.count as string) || "0"),
            color: SEVERITY_COLORS[sevName] || CHART_COLORS[0],
          };
        }),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumfamily":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.family as any)?.name || "Unknown",
          value: parseInt((r.count as string) || "0"),
          count: parseInt((r.count as string) || "0"),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumip":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: xField ? extractLabel(r[xField]) : (r.ip as string) || "Unknown",
          value: parseInt((r.count as string) || "0"),
          count: parseInt((r.count as string) || "0"),
          Critical: parseInt((r.severityCritical as string) || "0"),
          High: parseInt((r.severityHigh as string) || "0"),
          Medium: parseInt((r.severityMedium as string) || "0"),
          Low: parseInt((r.severityLow as string) || "0"),
          Info: parseInt((r.severityInfo as string) || "0"),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["Critical", "High", "Medium", "Low", "Info"],
      };

    case "sumport":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: `Port ${r.port || "Unknown"}`,
          value: parseInt((r.count as string) || "0"),
          count: parseInt((r.count as string) || "0"),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumprotocol":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.protocol as string) || "Unknown",
          value: parseInt((r.count as string) || "0"),
          count: parseInt((r.count as string) || "0"),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumcve":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.cveID || r.name || "Unknown") as string,
          value: parseInt((r.count || r.total || "0") as string),
          count: parseInt((r.count || r.total || "0") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumasset":
    case "sumdnsname":
    case "sumclassa":
    case "sumclassb":
    case "sumclassc":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.name || r.dnsName || (r.asset as any)?.name || extractLabel(r[detectLabelField(r)])) as string,
          value: parseInt((r.count || r.total || "0") as string),
          count: parseInt((r.count || r.total || "0") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumid":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.pluginName || r.name || `Plugin ${r.pluginID || "Unknown"}`) as string,
          value: parseInt((r.count || r.total || "0") as string),
          count: parseInt((r.count || r.total || "0") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "listos":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.operatingSystem || r.name || "Unknown OS") as string,
          value: parseInt((r.count || r.total || "1") as string),
          count: parseInt((r.count || r.total || "1") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "listsoftware":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.name || r.softwareCPE || "Unknown") as string,
          value: parseInt((r.count || r.total || "1") as string),
          count: parseInt((r.count || r.total || "1") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "listservices":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.name || r.serviceName || `Port ${r.port || "?"}`) as string,
          value: parseInt((r.count || r.total || "1") as string),
          count: parseInt((r.count || r.total || "1") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "sumremediation":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.solution || r.name || "Unknown Remediation") as string,
          value: parseInt((r.hostTotal || r.total || r.count || "0") as string),
          count: parseInt((r.hostTotal || r.total || r.count || "0") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: ["count"],
      };

    case "trend":
      return {
        chartData: data.slice(0, maxItems).map(r => ({
          name: (r.date || r.day || r.timestamp || "Unknown") as string,
          value: parseInt((r.count || r.total || "0") as string),
          count: parseInt((r.count || r.total || "0") as string),
          Critical: parseInt((r.critical || r.severityCritical || "0") as string),
          High: parseInt((r.high || r.severityHigh || "0") as string),
          Medium: parseInt((r.medium || r.severityMedium || "0") as string),
          Low: parseInt((r.low || r.severityLow || "0") as string),
          Info: parseInt((r.info || r.severityInfo || "0") as string),
        })),
        labelKey: "name",
        valueKey: "count",
        valueKeys: data[0]?.critical !== undefined ? ["Critical", "High", "Medium", "Low", "Info"] : ["count"],
      };

    default: {
      // Smart auto-detection for listvuln, vulndetails, etc.
      const labelField = xField || detectLabelField(sample);
      const valueField = yField || detectValueField(sample);

      // If the data is a list of items without a numeric "count" field,
      // aggregate by the label field
      const hasNumericValue = data.some(r => extractNumber(r[valueField]) > 0);

      if (hasNumericValue) {
        return {
          chartData: data.slice(0, maxItems).map(r => ({
            name: extractLabel(r[labelField]),
            value: extractNumber(r[valueField]),
            [valueField]: extractNumber(r[valueField]),
          })),
          labelKey: "name",
          valueKey: valueField,
          valueKeys: [valueField],
        };
      }

      // Aggregate: count occurrences of each label value
      const counts: Record<string, number> = {};
      data.forEach(r => {
        const label = extractLabel(r[labelField]);
        counts[label] = (counts[label] || 0) + 1;
      });

      const chartData = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxItems)
        .map(([name, count]) => ({
          name,
          value: count,
          count,
          color: SEVERITY_COLORS[name],
        }));

      return { chartData, labelKey: "name", valueKey: "count", valueKeys: ["count"] };
    }
  }
}

/**
 * Detect if data has severity breakdown fields (sumip style).
 */
export function hasSeverityBreakdown(data: Record<string, unknown>[]): boolean {
  if (!data.length) return false;
  const sample = data[0];
  return "severityCritical" in sample || "severityHigh" in sample;
}
