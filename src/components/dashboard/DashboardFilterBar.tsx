import { useState, useCallback, useRef, useEffect } from "react";
import { DashboardFilter, VULN_FILTER_NAMES, FILTER_OPERATORS } from "@/types/dashboard";
import { Filter, Plus, X, Search } from "lucide-react";

interface DashboardFilterBarProps {
  filters: DashboardFilter[];
  onChange: (filters: DashboardFilter[]) => void;
}

const SEVERITY_OPTIONS = [
  { value: "4", label: "Critical" },
  { value: "3", label: "High" },
  { value: "2", label: "Medium" },
  { value: "1", label: "Low" },
  { value: "0", label: "Info" },
];

const QUICK_FILTERS = [
  { label: "Universal Search", filterName: "universal", placeholder: "Search all fields..." },
  { label: "CVE ID", filterName: "cveID", placeholder: "CVE-2021-44228" },
  { label: "IP Address", filterName: "ip", placeholder: "192.168.1.0/24" },
  { label: "Plugin ID", filterName: "pluginID", placeholder: "12345" },
  { label: "Severity", filterName: "severity", placeholder: "" },
  { label: "Plugin Type", filterName: "pluginType", placeholder: "" },
  { label: "DNS Name", filterName: "dnsName", placeholder: "*.internal" },
];

export function DashboardFilterBar({ filters, onChange }: DashboardFilterBarProps) {
  const [expanded, setExpanded] = useState(filters.length > 0);
  const [quickValue, setQuickValue] = useState("");
  const [quickType, setQuickType] = useState("universal");

  const addFilter = (filterName: string, value: string) => {
    if (!value.trim()) return;
    onChange([
      ...filters,
      { id: Math.random().toString(36).substring(2, 9), filterName, operator: "=", value: value.trim() },
    ]);
    setQuickValue("");
  };

  const addAdvancedFilter = () => {
    onChange([
      ...filters,
      { id: Math.random().toString(36).substring(2, 9), filterName: "severity", operator: "=", value: "" },
    ]);
    setExpanded(true);
  };

  const removeFilter = (id: string) => {
    const updated = filters.filter(f => f.id !== id);
    onChange(updated);
    if (updated.length === 0) setExpanded(false);
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const draftRef = useRef<Record<string, string>>({});
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => {
    const ids = new Set(filters.map(f => f.id));
    setDraftValues(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (!ids.has(k)) delete next[k]; });
      return next;
    });
  }, [filters.length]);
  const updateFilter = useCallback((id: string, updates: Partial<DashboardFilter>) => {
    const isTextInput = "value" in updates && typeof updates.value === "string";
    if (isTextInput) {
      draftRef.current = { ...draftRef.current, [id]: updates.value as string };
      setDraftValues(prev => ({ ...prev, [id]: updates.value as string }));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const currentFilters = filtersRef.current;
        const value = draftRef.current[id] ?? currentFilters.find(f => f.id === id)?.value ?? "";
        onChange(currentFilters.map(f => f.id === id ? { ...f, value } : f));
        delete draftRef.current[id];
        setDraftValues(prev => { const n = { ...prev }; delete n[id]; return n; });
        debounceRef.current = null;
      }, 400);
    } else {
      onChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
    }
  }, [filters, onChange]);

  return (
    <div className="border-b border-border bg-card/30">
      {/* Quick filter bar */}
      <div className="flex items-center gap-2 px-6 py-2">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground shrink-0">Global Filters</span>

        <select
          value={quickType}
          onChange={e => setQuickType(e.target.value)}
          className="px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground"
        >
          {QUICK_FILTERS.map(qf => (
            <option key={qf.filterName} value={qf.filterName}>{qf.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1 flex-1 max-w-sm">
          {quickType === "severity" ? (
            <select
              value={quickValue}
              onChange={e => {
                setQuickValue(e.target.value);
                if (e.target.value) addFilter("severity", e.target.value);
              }}
              className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground"
            >
              <option value="">Select severity…</option>
              {SEVERITY_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
              ))}
            </select>
          ) : quickType === "pluginType" ? (
            <select
              value={quickValue}
              onChange={e => {
                setQuickValue(e.target.value);
                if (e.target.value) addFilter("pluginType", e.target.value);
              }}
              className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground"
            >
              <option value="">Select type…</option>
              <option value="active">Active</option>
              <option value="compliance">Compliance</option>
            </select>
          ) : (
            <input
              value={quickValue}
              onChange={e => setQuickValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addFilter(quickType, quickValue); }}
              placeholder={QUICK_FILTERS.find(q => q.filterName === quickType)?.placeholder || "Enter value..."}
              className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground font-mono placeholder:text-muted-foreground/50"
            />
          )}
          {quickType !== "severity" && quickType !== "pluginType" && (
            <button
              onClick={() => addFilter(quickType, quickValue)}
              className="p-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              title="Apply filter"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Active filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {filters.map(f => {
            let label = "";
            if (f.filterName === "universal") {
              label = `Search: ${f.value}`;
            } else if (f.filterName === "severity") {
              const sev = SEVERITY_OPTIONS.find(s => s.value === f.value);
              label = `severity = ${sev?.label || f.value}`;
            } else {
              label = `${f.filterName} ${f.operator} ${f.value}`;
            }
            
            return (
              <span key={f.id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-primary/15 text-primary rounded-full font-mono">
                {label}
                <button onClick={() => removeFilter(f.id)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>

        <button
          onClick={addAdvancedFilter}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
        >
          <Plus className="w-3 h-3" /> Advanced
        </button>

        {filters.length > 0 && (
          <button
            onClick={() => { onChange([]); setExpanded(false); }}
            className="text-xs text-destructive/70 hover:text-destructive shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded advanced filters */}
      {expanded && filters.length > 0 && (
        <div className="px-6 pb-2 space-y-1">
          {filters.map(filter => (
            <div key={filter.id} className="flex items-center gap-2">
              <select
                value={filter.filterName}
                onChange={e => updateFilter(filter.id, { filterName: e.target.value })}
                className="w-40 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground font-mono"
              >
                {VULN_FILTER_NAMES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select
                value={filter.operator}
                onChange={e => updateFilter(filter.id, { operator: e.target.value })}
                className="w-24 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground"
              >
                {FILTER_OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              
              {filter.filterName === "severity" ? (
                <select
                  value={filter.value}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground"
                >
                  <option value="">Select severity…</option>
                  {SEVERITY_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                  ))}
                </select>
              ) : filter.filterName === "pluginType" ? (
                <select
                  value={filter.value}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground"
                >
                  <option value="">Select type…</option>
                  <option value="active">Active</option>
                  <option value="compliance">Compliance</option>
                </select>
              ) : (
                <input
                  value={draftValues[filter.id] ?? filter.value}
                  onChange={e => updateFilter(filter.id, { value: e.target.value })}
                  placeholder="value"
                  className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground font-mono"
                />
              )}
              <button onClick={() => removeFilter(filter.id)} className="p-1 text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
