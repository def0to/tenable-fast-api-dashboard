import { WidgetType, VULN_TOOLS, TenableVulnTool } from "@/types/dashboard";
import {
  BarChart3, LineChart, PieChart, TrendingUp, Table, AreaChart, Plus,
  Activity, TreePine, Cloud, GitBranch, Layers, Network, Type, Columns, BarChart2, Layers2, AlignHorizontalDistributeCenter,
} from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

interface AddWidgetPanelProps {
  onAdd: (type: WidgetType, title: string, tool: TenableVulnTool) => void;
}

const WIDGET_OPTIONS: { type: WidgetType; label: string; icon: typeof BarChart3; desc: string }[] = [
  { type: "bar-chart", label: "Bar Chart", icon: BarChart3, desc: "Compare values across categories" },
  { type: "line-chart", label: "Line Chart", icon: LineChart, desc: "Show trends over time" },
  { type: "area-chart", label: "Area Chart", icon: AreaChart, desc: "Visualize volume changes" },
  { type: "pie-chart", label: "Pie Chart", icon: PieChart, desc: "Show proportions with values" },
  { type: "kpi", label: "KPI Card", icon: TrendingUp, desc: "Display key metrics" },
  { type: "table", label: "Data Table", icon: Table, desc: "Tabular data view" },
  { type: "gauge", label: "Gauge", icon: Activity, desc: "Radial score indicator" },
  { type: "treemap", label: "Treemap", icon: TreePine, desc: "Hierarchical area blocks" },
  { type: "wordcloud", label: "Word Cloud", icon: Cloud, desc: "Text frequency visualization" },
  { type: "sankey", label: "Sankey Diagram", icon: GitBranch, desc: "Flow relationships" },
  { type: "ribbon", label: "Ribbon Chart", icon: Layers, desc: "Stacked stream graph" },
  { type: "decomposition-tree", label: "Decomposition Tree", icon: Network, desc: "Interactive drill-down hierarchy" },
  { type: "text", label: "Text", icon: Type, desc: "Static or dynamic text block" },
  { type: "clustered-column", label: "Clustered Column", icon: Columns, desc: "Side-by-side bar comparison" },
  { type: "line-column-combo", label: "Line & Column", icon: BarChart2, desc: "Bars with trend line overlay" },
  { type: "stacked-area", label: "Stacked Area", icon: Layers2, desc: "100% stacked area chart" },
  { type: "stacked-bar-100", label: "100% Stacked Bar", icon: AlignHorizontalDistributeCenter, desc: "Horizontal percentage bars" },
  { type: "sunburst", label: "Sunburst", icon: PieChart, desc: "Hierarchical nested rings" },
  { type: "heatmap", label: "Heatmap Matrix", icon: Table, desc: "Density grid of hotspots" },
  { type: "stacked-bar", label: "Stacked Bar", icon: BarChart2, desc: "Absolute values stacked by severity" },
  { type: "bar-negative", label: "Divergent Bar", icon: AlignHorizontalDistributeCenter, desc: "Side-by-side comparison (Positive vs Negative)" },
];

export function AddWidgetPanel({ onAdd }: AddWidgetPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [title, setTitle] = useState("");
  const [tool, setTool] = useState<TenableVulnTool>("listvuln");

  const handleAdd = () => {
    if (selectedType) {
      onAdd(selectedType, title || WIDGET_OPTIONS.find(w => w.type === selectedType)!.label, tool);
      setOpen(false);
      setSelectedType(null);
      setTitle("");
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        <Plus className="w-4 h-4" /> Add Widget
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => { setOpen(false); setSelectedType(null); }}>
      <div className="w-full max-w-xl mx-4 bg-card border border-border rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Add Widget</h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
            {WIDGET_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button key={opt.type} onClick={() => setSelectedType(opt.type)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-center ${
                    selectedType === opt.type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                  }`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[11px] font-medium leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {selectedType && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={WIDGET_OPTIONS.find(w => w.type === selectedType)?.label}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tenable Tool</label>
                <select value={tool} onChange={(e) => setTool(e.target.value as TenableVulnTool)}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  {VULN_TOOLS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={() => { setOpen(false); setSelectedType(null); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={handleAdd} disabled={!selectedType}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            Add Widget
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
