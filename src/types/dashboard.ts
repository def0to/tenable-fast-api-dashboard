import { LayoutItem } from "react-grid-layout/legacy";

export type WidgetType =
  | "bar-chart" | "line-chart" | "pie-chart" | "kpi" | "table" | "area-chart"
  | "gauge" | "treemap" | "wordcloud" | "sankey" | "ribbon"
  | "decomposition-tree" | "text" | "clustered-column" | "line-column-combo" | "stacked-area"
  | "stacked-bar-100" | "sunburst" | "heatmap" | "stacked-bar" | "bar-negative";

// Tenable SC Analysis Types
export type TenableAnalysisType = "vuln" | "event" | "mobile" | "user";
export type TenableSourceType = "cumulative" | "individual" | "patched";

export type TenableVulnTool =
  | "listvuln" | "vulndetails" | "vulnipdetail" | "vulnipsummary"
  | "sumip" | "sumseverity" | "sumfamily" | "sumport" | "sumprotocol"
  | "sumasset" | "sumid" | "sumcve" | "sumdnsname" | "sumclassa"
  | "sumclassb" | "sumclassc" | "iplist" | "listservices" | "listos"
  | "listsoftware" | "listwebservers" | "listwebclients" | "listsshservers"
  | "listmailclients" | "sumremediation" | "sumcce" | "summsbulletin"
  | "sumuserresponsibility" | "trend";

export interface TenableFilter {
  id: string;
  filterName: string;
  operator: string;
  value: string;
}

export interface TenableQueryConfig {
  type: TenableAnalysisType;
  tool: TenableVulnTool;
  sourceType: TenableSourceType;
  filters: TenableFilter[];
  sortField: string;
  sortDir: "ASC" | "DESC";
  startOffset: number;
  endOffset: number;
  maxResults?: number;   // Auto-paginate: fetch up to this many records
  pageSize?: number;     // Records per page (default 200)
  pageDelay?: number;    // Seconds between pages (default 0.5)
  timeRange?: string;    // Selected time range (e.g. "1M", "3M", "ALL", "CUSTOM")
  startTime?: number;    // Unix timestamp (seconds)
  endTime?: number;      // Unix timestamp (seconds)
}

export interface WidgetColors {
  palette?: string[];
  background?: string;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  query: TenableQueryConfig;
  layout: LayoutItem;
  colors?: WidgetColors;
  showValues?: boolean; // For pie charts, show numbers
  showLabels?: boolean; // Show data labels on chart elements
  showPercentage?: boolean; // Show values as percentage of total
  xField?: string;     // Override X-axis data field
  yField?: string;     // Override Y-axis data field
  textContent?: string; // For text widgets (supports markdown-like formatting)
  compareSourceTypes?: TenableSourceType[]; // Stack multiple source types for comparison
}

export interface DashboardFilter {
  id: string;
  filterName: string;
  operator: string;
  value: string;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
  refreshInterval: number; // ms, 0 = off
  createdAt: number;
  globalFilters?: DashboardFilter[]; // Dashboard-level filters applied to all widgets
}

export interface TenableSavedQuery {
  id: string;
  name: string;
  description: string;
  type?: string;
  tool?: string;
  filters?: TenableFilter[];
}

// Refresh interval options
export const REFRESH_INTERVALS = [
  { value: 0, label: "Off" },
  { value: 60000, label: "1 min" },
  { value: 300000, label: "5 min" },
  { value: 900000, label: "15 min" },
  { value: 1800000, label: "30 min" },
  { value: 3600000, label: "1 hour" },
];

// Filter names available for vuln type queries
export const VULN_FILTER_NAMES = [
  "universal", "severity", "ip", "port", "protocol", "pluginID", "pluginName",
  "pluginText", "family", "familyID", "cveID", "dnsName",
  "exploitAvailable", "baseCVSSScore", "cvssV3BaseScore", "vprScore",
  "epssScore", "firstSeen", "lastSeen", "pluginType", "repository",
  "repositoryIDs", "asset", "assetID", "acceptRiskStatus",
  "recastRiskStatus", "mitigatedStatus", "xref", "cpe",
  "pluginModified", "pluginPublished", "vulnPublished", "patchPublished",
  "stigSeverity", "dataFormat", "uuid",
];

export const VULN_TOOLS: { value: TenableVulnTool; label: string }[] = [
  { value: "listvuln", label: "List Vulnerabilities" },
  { value: "vulndetails", label: "Vulnerability Details" },
  { value: "vulnipdetail", label: "Vuln IP Detail" },
  { value: "vulnipsummary", label: "Vuln IP Summary" },
  { value: "sumip", label: "Summary by IP" },
  { value: "sumseverity", label: "Summary by Severity" },
  { value: "sumfamily", label: "Summary by Family" },
  { value: "sumport", label: "Summary by Port" },
  { value: "sumprotocol", label: "Summary by Protocol" },
  { value: "sumasset", label: "Summary by Asset" },
  { value: "sumid", label: "Summary by Plugin" },
  { value: "sumcve", label: "Summary by CVE" },
  { value: "sumdnsname", label: "Summary by DNS Name" },
  { value: "sumremediation", label: "Remediation Summary" },
  { value: "listservices", label: "List Services" },
  { value: "listos", label: "List OS" },
  { value: "listsoftware", label: "List Software" },
  { value: "iplist", label: "IP List" },
  { value: "trend", label: "Trend" },
];

export const FILTER_OPERATORS = [
  { value: "=", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: "<=", label: "less or equal" },
  { value: ">=", label: "greater or equal" },
];

export const SOURCE_TYPES: { value: TenableSourceType; label: string }[] = [
  { value: "cumulative", label: "Cumulative" },
  { value: "individual", label: "Individual Scan" },
  { value: "patched", label: "Patched" },
];
