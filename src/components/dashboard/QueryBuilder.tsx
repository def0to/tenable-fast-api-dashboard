import { useState } from "react";
import {
  Widget, TenableQueryConfig, TenableFilter, TenableVulnTool, TenableSavedQuery, TenableSourceType,
  VULN_FILTER_NAMES, VULN_TOOLS, FILTER_OPERATORS, SOURCE_TYPES, WidgetType,
} from "@/types/dashboard";
import { SavedQueryPicker } from "@/components/dashboard/SavedQueryPicker";
import { X, Plus, Play } from "lucide-react";

const SEVERITY_OPTIONS = [
  { value: "4", label: "Critical" },
  { value: "3", label: "High" },
  { value: "2", label: "Medium" },
  { value: "1", label: "Low" },
  { value: "0", label: "Info" },
];

interface QueryBuilderProps {
  widget: Widget;
  onSave: (widget: Widget) => void;
  onCancel: () => void;
  isConnected?: boolean;
}

const WIDGET_TYPES: { value: WidgetType; label: string }[] = [
  { value: "bar-chart", label: "Bar Chart" },
  { value: "line-chart", label: "Line Chart" },
  { value: "area-chart", label: "Area Chart" },
  { value: "pie-chart", label: "Pie Chart" },
  { value: "kpi", label: "KPI Card" },
  { value: "table", label: "Table" },
  { value: "gauge", label: "Gauge" },
  { value: "treemap", label: "Treemap" },
  { value: "wordcloud", label: "Word Cloud" },
  { value: "sankey", label: "Sankey" },
  { value: "ribbon", label: "Ribbon" },
  { value: "decomposition-tree", label: "Decomposition Tree" },
  { value: "text", label: "Text" },
  { value: "clustered-column", label: "Clustered Column" },
  { value: "line-column-combo", label: "Line & Column Combo" },
  { value: "stacked-area", label: "Stacked Area" },
  { value: "stacked-bar-100", label: "100% Stacked Bar" },
  { value: "sunburst", label: "Sunburst" },
  { value: "heatmap", label: "Heatmap Matrix" },
  { value: "stacked-bar", label: "Stacked Bar (Absolute)" },
  { value: "bar-negative", label: "Divergent Bar (Negative)" },
];

export function QueryBuilder({ widget, onSave, onCancel, isConnected = false }: QueryBuilderProps) {
  const [title, setTitle] = useState(widget.title);
  const [type, setType] = useState<WidgetType>(widget.type);
  const [query, setQuery] = useState<TenableQueryConfig>({ ...widget.query });
  const [xField, setXField] = useState(widget.xField || "");
  const [yField, setYField] = useState(widget.yField || "");
  const [showLabels, setShowLabels] = useState(widget.showLabels ?? false);
  const [showPercentage, setShowPercentage] = useState(widget.showPercentage ?? false);
  const [compareSourceTypes, setCompareSourceTypes] = useState<TenableSourceType[]>(widget.compareSourceTypes || []);
  const [textContent, setTextContent] = useState(widget.textContent || "");

  const handleSelectSavedQuery = (savedQuery: TenableSavedQuery) => {
    setQuery(prev => ({
      ...prev,
      // If the saved query has an ID, we use it, otherwise we copy its details
      id: savedQuery.id,
      tool: (savedQuery.tool as TenableVulnTool) || prev.tool,
      type: (savedQuery.type as any) || prev.type,
      filters: savedQuery.filters 
        ? savedQuery.filters.map(f => ({ ...f, id: Math.random().toString(36).substring(2, 9) }))
        : prev.filters,
    }));
    setTitle(savedQuery.name);
  };

  const addFilter = () => {
    setQuery({
      ...query,
      filters: [...query.filters, { id: Math.random().toString(36).substring(2, 9), filterName: "severity", operator: "=", value: "" }],
    });
  };

  const removeFilter = (id: string) => {
    setQuery({ ...query, filters: query.filters.filter((f) => f.id !== id) });
  };

  const updateFilter = (id: string, updates: Partial<TenableFilter>) => {
    setQuery({
      ...query,
      filters: query.filters.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    });
  };

  const handleSave = () => {
    onSave({
      ...widget,
      title,
      type,
      query,
      xField: xField || undefined,
      yField: yField || undefined,
      showLabels,
      showPercentage,
      compareSourceTypes: compareSourceTypes.length > 0 ? compareSourceTypes : undefined,
      textContent: type === "text" ? textContent : widget.textContent,
    });
  };

  // Build preview of the Tenable query JSON — matches executeAnalysis logic
  const getQueryPreview = () => {
    const filters = query.filters.map(f => ({ filterName: f.filterName, operator: f.operator, value: f.value }));
    
    if (query.timeRange && query.timeRange !== "ALL") {
      let filterName = query.sourceType === "patched" ? "lastMitigated" : "lastSeen";
      let value = "";
      if (query.timeRange === "CUSTOM") {
        if (query.startTime && query.endTime) value = `${query.startTime}-${query.endTime}`;
        else if (query.startTime) value = `${query.startTime}-`;
      } else {
        const days = query.timeRange === "1M" ? 30 : query.timeRange === "3M" ? 90 : query.timeRange === "6M" ? 180 : 365;
        value = `${days}:all`;
      }
      if (value) filters.push({ filterName, operator: "=", value });
    }

    const preview: Record<string, any> = {
      type: query.type,
      sourceType: query.sourceType,
      query: {
        tool: query.tool,
        type: query.type,
        filters: filters,
      },
    };

    if (query.sortField) {
      preview.sortField = query.sortField;
      preview.sortDir = query.sortDir;
    }

    if (query.maxResults) {
      preview.maxResults = query.maxResults;
      preview.pageSize = query.pageSize || 200;
    } else {
      preview.startOffset = query.startOffset;
      preview.endOffset = query.endOffset;
    }

    return preview;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-2xl max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Widget Configuration</h2>
          <button onClick={onCancel} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Title & Widget Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Widget Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as WidgetType)}
                className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground">
                {WIDGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Text Widget Content */}
          {type === "text" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Content (supports **bold**, # headings, - lists, {"{field}"} placeholders)
              </label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                rows={6}
                placeholder={"# Dashboard Summary\n\nTotal vulnerabilities: {count:sum}\n\n- **Critical**: needs attention\n- Use {field} for dynamic data"}
                className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Simplified Header for Query Config */}
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Query Parameters</h3>
            <div className="px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
              <span className="text-[9px] font-black text-primary uppercase">Module: Vulnerability</span>
            </div>
          </div>

          {/* Source Type */}
          {type !== "text" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data Source</label>
              <select value={query.sourceType} onChange={(e) => setQuery({ ...query, sourceType: e.target.value as any, type: "vuln" })}
                className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary outline-none">
                {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}

          {/* Compare Source Types — stack multiple source types */}
          {type !== "text" && type !== "kpi" && type !== "table" && (
            <div className="border border-border rounded-md p-3 space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Stack Source Types (compare cumulative vs patched, etc.)
              </label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((st) => {
                  const isSelected = compareSourceTypes.includes(st.value);
                  return (
                    <label key={st.value} className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCompareSourceTypes(prev => [...prev, st.value]);
                          } else {
                            setCompareSourceTypes(prev => prev.filter(v => v !== st.value));
                          }
                        }}
                        className="rounded border-border"
                      />
                      {st.label}
                    </label>
                  );
                })}
              </div>
              {compareSourceTypes.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Will run {compareSourceTypes.length} queries and stack results. Each series labeled by source type.
                </p>
              )}
            </div>
          )}

          {/* Tool */}
          {type !== "text" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tool (View)</label>
                <select value={query.tool} onChange={(e) => setQuery({ ...query, tool: e.target.value as TenableVulnTool })}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground">
                  {VULN_TOOLS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Time Range</label>
                <select 
                  value={query.timeRange || "ALL"} 
                  onChange={(e) => setQuery({ ...query, timeRange: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground"
                >
                  <option value="ALL">All Time</option>
                  <option value="1M">Last Month</option>
                  <option value="3M">Last 3 Months</option>
                  <option value="6M">Last 6 Months</option>
                  <option value="1Y">Last Year</option>
                  <option value="CUSTOM">Custom Range...</option>
                </select>
              </div>
            </div>
          )}

          {/* Custom Date Range Picker */}
          {query.timeRange === "CUSTOM" && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-md border border-border/50">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={query.startTime ? new Date(query.startTime * 1000).toISOString().split('T')[0] : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : null;
                    setQuery({ ...query, startTime: date ? Math.floor(date.getTime() / 1000) : undefined });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded text-foreground focus:ring-1 focus:ring-primary outline-none" 
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">End Date</label>
                <input 
                  type="date" 
                  value={query.endTime ? new Date(query.endTime * 1000).toISOString().split('T')[0] : ""}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : null;
                    setQuery({ ...query, endTime: date ? Math.floor(date.getTime() / 1000) : undefined });
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-secondary border border-border rounded text-foreground focus:ring-1 focus:ring-primary outline-none" 
                />
              </div>
            </div>
          )}

          {/* X/Y Axis Field Mapping - for chart types */}
          {["bar-chart", "line-chart", "area-chart", "clustered-column", "line-column-combo", "stacked-area", "stacked-bar-100"].includes(type) && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">X-Axis Field (optional)</label>
                  <input value={xField} onChange={(e) => setXField(e.target.value)}
                    placeholder="auto-detect (e.g. ip, name)"
                    className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Y-Axis Field (optional)</label>
                  <input value={yField} onChange={(e) => setYField(e.target.value)}
                    placeholder="auto-detect (e.g. count)"
                    className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded border-border" />
                Show data labels on chart
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={showPercentage} onChange={(e) => setShowPercentage(e.target.checked)}
                  className="rounded border-border" />
                Show values as percentage (% of total)
              </label>
            </div>
          )}

          {/* Filters */}
          {type !== "text" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">Filters</label>
                <button onClick={addFilter} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                  <Plus className="w-3 h-3" /> Add Filter
                </button>
              </div>
              <div className="space-y-2">
                {query.filters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-2">
                    <select value={filter.filterName} onChange={(e) => updateFilter(filter.id, { filterName: e.target.value })}
                      className="flex-1 px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground font-mono">
                      {VULN_FILTER_NAMES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={filter.operator} onChange={(e) => updateFilter(filter.id, { operator: e.target.value })}
                      className="w-28 px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground">
                      {FILTER_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                    </select>
                    {filter.filterName === "severity" ? (
                      <div className="flex-1 flex flex-wrap gap-1 p-1.5 bg-secondary border border-border rounded-md">
                        {SEVERITY_OPTIONS.map(opt => {
                          const values = filter.value ? filter.value.split(",") : [];
                          const isChecked = values.includes(opt.value);
                          return (
                            <label key={opt.value} className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${isChecked ? "bg-primary/20 text-primary" : "hover:bg-muted text-muted-foreground"}`}>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isChecked}
                                onChange={(e) => {
                                  let newValues;
                                  if (e.target.checked) {
                                    newValues = [...values, opt.value];
                                  } else {
                                    newValues = values.filter(v => v !== opt.value);
                                  }
                                  // Sort to keep it consistent (4,3,2,1,0)
                                  newValues.sort((a, b) => Number(b) - Number(a));
                                  updateFilter(filter.id, { value: newValues.join(",") });
                                }}
                              />
                              <span className="text-[10px] font-bold uppercase">{opt.label.slice(0, 4)}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : filter.filterName === "pluginType" ? (
                      <select value={filter.value} onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        className="flex-1 px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground">
                        <option value="">Select type…</option>
                        <option value="active">Active</option>
                        <option value="compliance">Compliance</option>
                      </select>
                    ) : (
                      <input value={filter.value} onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                        placeholder="value" className="flex-1 px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground font-mono" />
                    )}
                    <button onClick={() => removeFilter(filter.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {query.filters.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No filters — all results returned</p>
                )}
              </div>
            </div>
          )}

          {/* Saved Queries */}
          {type !== "text" && (
            <SavedQueryPicker
              onSelectQuery={handleSelectSavedQuery}
              currentFilters={query.filters}
              currentTool={query.tool}
              isConnected={isConnected}
            />
          )}

          {/* Sort & Pagination */}
          {type !== "text" && (
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sort Field</label>
                <input value={query.sortField} onChange={(e) => setQuery({ ...query, sortField: e.target.value })}
                  placeholder="e.g. severity" className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Direction</label>
                <select value={query.sortDir} onChange={(e) => setQuery({ ...query, sortDir: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground">
                  <option value="ASC">Ascending</option>
                  <option value="DESC">Descending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Offset</label>
                <input type="number" value={query.startOffset} onChange={(e) => setQuery({ ...query, startOffset: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" min={0}
                  disabled={!!query.maxResults} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Offset</label>
                <input type="number" value={query.endOffset} onChange={(e) => setQuery({ ...query, endOffset: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground" min={1}
                  disabled={!!query.maxResults} />
              </div>
            </div>
          )}

          {/* Auto-Pagination */}
          {type !== "text" && (
            <div className="border border-border rounded-md p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Auto-Pagination (large datasets)</label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input type="checkbox" checked={!!query.maxResults}
                    onChange={(e) => setQuery({ ...query, maxResults: e.target.checked ? 10000 : undefined })}
                    className="rounded border-border" />
                  Enable
                </label>
              </div>
              {query.maxResults ? (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Max Results</label>
                    <input type="number" value={query.maxResults} onChange={(e) => setQuery({ ...query, maxResults: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground" min={1} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Page Size</label>
                    <input type="number" value={query.pageSize || 200} onChange={(e) => setQuery({ ...query, pageSize: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground" min={10} max={1000} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Page Delay (s)</label>
                    <input type="number" value={query.pageDelay ?? 0.5} onChange={(e) => setQuery({ ...query, pageDelay: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground" min={0.1} max={5} step={0.1} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Disabled — using manual offsets above</p>
              )}
            </div>
          )}

          {/* Query Preview */}
          {type !== "text" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tenable SC Query (JSON)</label>
              <pre className="bg-muted rounded-md p-3 font-mono text-xs text-foreground overflow-x-auto max-h-40">
                {JSON.stringify(getQueryPreview(), null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2">
            <Play className="w-3.5 h-3.5" /> Apply & Run
          </button>
        </div>
      </div>
    </div>
  );
}
