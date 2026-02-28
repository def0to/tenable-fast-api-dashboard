import { useState } from "react";
import { Widget } from "@/types/dashboard";
import { isEpochField, epochToDate } from "@/lib/date-utils";

interface TableWidgetProps {
  widget: Widget;
  data: Record<string, unknown>[];
}

function flattenValue(val: unknown, col: string): string {
  if (val === null || val === undefined) return "—";
  // Convert epoch timestamps to human-readable dates
  if (isEpochField(col)) {
    return epochToDate(val as string | number);
  }
  if (typeof val === "object") {
    const v = val as Record<string, unknown>;
    if (v.name) return String(v.name);
    if (v.id) return String(v.id);
    return JSON.stringify(val);
  }
  return String(val);
}

// Prioritize important columns and exclude noisy internal fields
const PRIORITY_COLUMNS = [
  "pluginID", "pluginName", "severity", "ip", "port", "protocol",
  "dnsName", "family", "vprScore", "cvssV3BaseScore", "firstSeen", "lastSeen",
  "exploitAvailable", "riskFactor", "cve", "operatingSystem", "solution",
  "count", "name", "status", "total", "customer",
];

// Fields to hide from the table by default (internal/noisy)
const HIDDEN_COLUMNS = new Set([
  "uuid", "hostUniqueness", "hostUUID", "vulnUniqueness", "vulnUUID",
  "ips", "recastRiskRuleComment", "acceptRiskRuleComment",
  "hasBeenMitigated", "acceptRisk", "recastRisk",
  "pluginInfo", "pluginText", "vprContext", "seeAlso",
  "cvssVector", "cvssV3Vector", "cvssV3TemporalScore", "temporalScore",
  "macAddress", "netbiosName", "cpe", "bid", "xref",
  "checkType", "version", "stigSeverity",
  "seolDate", "dataFormat", "description", "synopsis",
  "baseScore", "acrScore", "assetExposureScore",
  "repository", "keyDrivers",
  "cvssV4BaseScore", "cvssV4Vector", "cvssV4ThreatScore", "cvssV4ThreatVector", "cvssV4Supplemental",
  "epssScore",
]);

function getColumns(data: Record<string, unknown>[]): string[] {
  if (!data.length) return [];
  const allKeys = Object.keys(data[0]).filter(k => !HIDDEN_COLUMNS.has(k));
  const prioritized = PRIORITY_COLUMNS.filter(k => allKeys.includes(k));
  const rest = allKeys.filter(k => !prioritized.includes(k));
  return [...prioritized, ...rest];
}

// Nice display names for column headers
const COLUMN_LABELS: Record<string, string> = {
  pluginID: "Plugin ID",
  pluginName: "Plugin Name",
  severity: "Severity",
  severityCritical: "Crit",
  severityHigh: "High",
  severityMedium: "Med",
  severityLow: "Low",
  severityInfo: "Info",
  ip: "IP Address",
  port: "Port",
  protocol: "Protocol",
  dnsName: "DNS Name",
  family: "Family",
  vprScore: "VPR",
  cvssV3BaseScore: "CVSS v3",
  firstSeen: "First Seen",
  lastSeen: "Last Seen",
  exploitAvailable: "Exploit",
  riskFactor: "Risk",
  cve: "CVE",
  operatingSystem: "OS",
  solution: "Solution",
  count: "Count",
  name: "Name",
  total: "Total",
  pluginPubDate: "Plugin Published",
  pluginModDate: "Plugin Modified",
  vulnPubDate: "Vuln Published",
  patchPubDate: "Patch Published",
  exploitEase: "Exploit Ease",
  exploitFrameworks: "Exploit Frameworks",
};

export function TableWidget({ widget, data }: TableWidgetProps) {
  const [limit, setLimit] = useState(50);

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No data returned
      </div>
    );
  }

  const columns = getColumns(data);
  const visibleData = data.slice(0, limit);
  const hasMore = data.length > limit;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr className="border-b border-border/50">
              {columns.map((col) => (
                <th key={col} className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur-sm whitespace-nowrap text-[10px] border-b border-border/50">
                  {COLUMN_LABELS[col] || col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {visibleData.map((row, i) => (
              <tr key={i} className="hover:bg-secondary/20 transition-colors group">
                {columns.map((col) => {
                  const val = flattenValue(row[col], col);
                  const isSeverity = col === "severity";
                  const sevName = isSeverity ? val : "";
                  const isExploit = col === "exploitAvailable";
                  const isRisk = col === "riskFactor";
                  
                  // Check if this is a severity summary column (e.g. sumip tool)
                  const isSeveritySummary = col.startsWith("severity") && col !== "severity";
                  const summaryType = isSeveritySummary ? col.replace("severity", "") : "";

                  return (
                    <td key={col} className="px-3 py-2.5 text-foreground/90 font-medium whitespace-nowrap max-w-[300px] truncate border-b border-border/10">
                      {isSeverity ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-tight text-white ${
                          sevName === "Critical" ? "bg-[#7d1010]" :
                          sevName === "High" ? "bg-[#d21c1c]" :
                          sevName === "Medium" ? "bg-[#ff9000]" :
                          sevName === "Low" ? "bg-[#228b22]" :
                          sevName === "Info" ? "bg-[#2f8af9]" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {val.toUpperCase()}
                        </span>
                      ) : isSeveritySummary && Number(val) > 0 ? (
                        <span className={`inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${
                          summaryType === "Critical" ? "bg-[#7d1010]" :
                          summaryType === "High" ? "bg-[#d21c1c]" :
                          summaryType === "Medium" ? "bg-[#ff9000]" :
                          summaryType === "Low" ? "bg-[#228b22]" :
                          summaryType === "Info" ? "bg-[#2f8af9]" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {val}
                        </span>
                      ) : isExploit && val === "Yes" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/20">
                          YES
                        </span>
                      ) : isExploit && val === "No" ? (
                        <span className="text-muted-foreground/60">No</span>
                      ) : isRisk ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          val === "Critical" ? "text-[#7d1010]" :
                          val === "High" ? "text-[#d21c1c]" :
                          val === "Medium" ? "text-[#ff9000]" :
                          val === "Low" ? "text-[#228b22]" :
                          val === "Info" ? "text-[#2f8af9]" :
                          "text-muted-foreground"
                        }`}>
                          {val}
                        </span>
                      ) : col === "solution" ? (
                        <span className="max-w-[250px] truncate block opacity-80" title={val}>{val}</span>
                      ) : (
                        <span className="opacity-90">{val}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        {hasMore && (
          <div className="p-4 flex justify-center border-t border-border/10 bg-secondary/5">
            <button 
              onClick={() => setLimit(prev => prev + 50)}
              className="px-4 py-1.5 text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded hover:bg-primary/20 transition-colors"
            >
              Show More ({data.length - limit} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
