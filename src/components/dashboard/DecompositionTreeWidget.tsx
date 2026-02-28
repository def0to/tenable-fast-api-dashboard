import { Widget } from "@/types/dashboard";
import { useState, useMemo } from "react";
import { ChevronRight, X, GitBranch } from "lucide-react";
import { CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";
import { isEpochField, epochToShortDate } from "@/lib/date-utils";

interface DecompositionTreeWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

interface TreeLevel {
  field: string;
  label: string;
}

interface TreeNode {
  name: string;
  value: number;
  percent: number;
  color: string;
  field: string;
}

// Known field labels for nice display names
const FIELD_LABELS: Record<string, string> = {
  severity: "Severity",
  family: "Family",
  ip: "IP Address",
  pluginName: "Plugin",
  pluginID: "Plugin ID",
  port: "Port",
  protocol: "Protocol",
  dnsName: "DNS Name",
  operatingSystem: "OS",
  name: "Name",
  cveID: "CVE",
  cve: "CVE",
  cpe: "CPE",
  softwareCPE: "Software",
  serviceName: "Service",
  riskFactor: "Risk Factor",
  exploitAvailable: "Exploit Available",
  exploitEase: "Exploit Ease",
  exploitFrameworks: "Exploit Frameworks",
  firstSeen: "First Seen",
  lastSeen: "Last Seen",
  vprScore: "VPR Score",
  cvssV3BaseScore: "CVSS v3",
  baseScore: "Base Score",
  solution: "Solution",
  synopsis: "Synopsis",
  repository: "Repository",
  checkType: "Check Type",
  hasBeenMitigated: "Mitigated",
  acceptRisk: "Accepted Risk",
  recastRisk: "Recast Risk",
  acrScore: "ACR Score",
  assetExposureScore: "AES",
};

// Fields to skip as drill-down levels (IDs, internal, pure aggregation)
const SKIP_FIELDS = new Set([
  "id", "count", "total", "value", "size", "amount", "quantity",
  "severityCritical", "severityHigh", "severityMedium", "severityLow", "severityInfo",
  "startOffset", "endOffset", "sortField", "sortDir",
  "uuid", "hostUniqueness", "hostUUID", "vulnUniqueness", "vulnUUID",
  "ips", "recastRiskRuleComment", "acceptRiskRuleComment",
  "pluginInfo", "pluginText", "vprContext", "seeAlso",
  "cvssVector", "cvssV3Vector", "cvssV3TemporalScore", "temporalScore",
  "macAddress", "netbiosName", "bid", "xref",
  "version", "stigSeverity", "seolDate", "dataFormat",
  "description", "keyDrivers",
  "cvssV4BaseScore", "cvssV4Vector", "cvssV4ThreatScore", "cvssV4ThreatVector", "cvssV4Supplemental",
  "epssScore", "hostTotal", "vulnTotal",
]);

// Tool-specific level orderings
const TOOL_LEVEL_ORDER: Record<string, string[]> = {
  listvuln: ["severity", "family", "ip", "pluginName", "operatingSystem", "port", "exploitAvailable"],
  vulndetails: ["severity", "pluginName", "ip", "port", "protocol", "exploitAvailable"],
  sumseverity: ["severity", "family", "ip", "pluginName"],
  sumfamily: ["family", "severity", "ip", "pluginName"],
  sumip: ["ip", "severity", "family", "pluginName", "port", "operatingSystem"],
  sumport: ["port", "protocol", "ip", "severity"],
  sumprotocol: ["protocol", "port", "ip", "severity"],
  sumid: ["pluginName", "severity", "family", "ip"],
  sumcve: ["cveID", "severity", "pluginName", "ip"],
  sumdnsname: ["dnsName", "ip", "severity", "family"],
  sumasset: ["name", "ip", "severity", "family"],
  listos: ["operatingSystem", "ip", "severity", "pluginName", "port"],
  listsoftware: ["name", "softwareCPE", "ip"],
  listservices: ["serviceName", "port", "protocol", "ip"],
  sumremediation: ["solution", "severity", "ip"],
  trend: ["name", "severity"],
};

function getLevels(tool: string, data: Record<string, any>[]): TreeLevel[] {
  if (!data || !data.length) return [];
  const sample = data[0];
  const added = new Set<string>();
  const levels: TreeLevel[] = [];

  const tryAdd = (field: string) => {
    if (added.has(field)) return;
    if (field in sample) {
      added.add(field);
      levels.push({
        field,
        label: FIELD_LABELS[field] || field.charAt(0).toUpperCase() + field.slice(1),
      });
    }
  };

  const preferred = TOOL_LEVEL_ORDER[tool];
  if (preferred) {
    for (const f of preferred) tryAdd(f);
  }

  // Fallback to auto-detecting categorical fields
  Object.keys(sample).forEach(field => {
    if (levels.length >= 8) return;
    if (SKIP_FIELDS.has(field) || added.has(field)) return;
    if (isEpochField(field)) return;
    
    const val = sample[field];
    if (typeof val === "object" || (typeof val === "string" && isNaN(Number(val)))) {
      tryAdd(field);
    }
  });

  return levels;
}

function extractFieldValue(row: Record<string, any>, field: string): string {
  const val = row[field];
  if (val === null || val === undefined) return "Unknown";
  if (typeof val === "object") return val.name || val.id || "Unknown Object";
  if (isEpochField(field)) return epochToShortDate(val);
  return String(val);
}

function buildLevelNodes(data: Record<string, any>[], field: string, maxItems: number = 15): TreeNode[] {
  const groups = new Map<string, number>();
  data.forEach(r => {
    const key = extractFieldValue(r, field);
    groups.set(key, (groups.get(key) || 0) + 1);
  });

  const total = data.length || 1;
  return Array.from(groups.entries())
    .map(([name, count], i) => ({
      name,
      value: count,
      percent: (count / total) * 100,
      color: SEVERITY_COLORS[name] || CHART_COLORS[i % CHART_COLORS.length],
      field,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, maxItems);
}

export function DecompositionTreeWidget({ widget, data }: DecompositionTreeWidgetProps) {
  const levels = useMemo(() => getLevels(widget.query.tool, data), [widget.query.tool, data]);
  const [selectedPath, setSelectedPath] = useState<{ field: string; value: string }[]>([]);

  if (!data || !data.length || !levels.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <GitBranch className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-xs italic">Decomposition tree requires detail-level data. Try using 'List Vulnerabilities' tool.</p>
      </div>
    );
  }

  // Iteratively calculate columns based on current path
  const columns = useMemo(() => {
    const cols: { level: TreeLevel; nodes: TreeNode[]; selectedValue?: string }[] = [];
    let currentData = data;

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const nodes = buildLevelNodes(currentData, level.field);
      const selection = selectedPath[i]; // Access by index for safety

      cols.push({ level, nodes, selectedValue: selection?.value });

      if (selection && selection.field === level.field) {
        currentData = currentData.filter(r => extractFieldValue(r, level.field) === selection.value);
      } else {
        break; // Stop at first unselected level
      }
    }
    return { cols, filteredCount: currentData.length };
  }, [data, levels, selectedPath]);

  const handleDrillDown = (node: TreeNode, levelIndex: number) => {
    setSelectedPath(prev => {
      const newPath = prev.slice(0, levelIndex);
      newPath.push({ field: node.field, value: node.name });
      return newPath;
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden select-none">
      {/* Breadcrumbs */}
      {selectedPath.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/40 bg-muted/10 flex-wrap">
          <button 
            onClick={() => setSelectedPath([])}
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
          {selectedPath.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-bold">
              {s.value}
            </span>
          ))}
        </div>
      )}

      {/* Grid Columns */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden divide-x divide-border/20">
        {columns.cols.map((col, colIdx) => {
          const maxValue = Math.max(...col.nodes.map(n => n.value), 1);
          return (
            <div key={col.level.field} className="flex-shrink-0 w-56 flex flex-col group/col">
              <div className="px-3 py-2 border-b border-border/30 bg-muted/20">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                  {col.level.label}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {col.nodes.map(node => {
                  const isSelected = col.selectedValue === node.name;
                  const barWidth = (node.value / maxValue) * 100;
                  return (
                    <button
                      key={node.name}
                      onClick={() => handleDrillDown(node, colIdx)}
                      className={`w-full text-left p-2 rounded-lg transition-all duration-200 group/item ${
                        isSelected 
                          ? "bg-primary/15 ring-1 ring-primary/30 shadow-sm" 
                          : "hover:bg-secondary/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground truncate pr-2" title={node.name}>
                          {node.name}
                        </span>
                        <ChevronRight className={`w-3 h-3 transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/40"}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${isSelected ? "opacity-100" : "opacity-60"}`}
                            style={{ width: `${barWidth}%`, backgroundColor: node.color }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-muted-foreground/80 tabular-nums">
                          {node.value.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Dynamic Summary */}
        <div className="flex-shrink-0 w-40 flex flex-col items-center justify-center p-6 bg-muted/5">
          <div className="text-3xl font-black text-foreground tabular-nums tracking-tight">
            {columns.filteredCount.toLocaleString()}
          </div>
          <div className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2 bg-secondary px-2 py-0.5 rounded">
            {selectedPath.length > 0 ? "Qualified" : "Total Rows"}
          </div>
        </div>
      </div>
    </div>
  );
}
