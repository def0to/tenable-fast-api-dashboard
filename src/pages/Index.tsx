import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from "react";
import { Responsive, WidthProvider, LayoutItem, Layout } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import { Widget, WidgetType, TenableVulnTool, Dashboard, DashboardFilter, TenableSourceType } from "@/types/dashboard";
import { WidgetWrapper } from "@/components/dashboard/WidgetWrapper";
import { ChartWidget } from "@/components/dashboard/ChartWidget";
import { KpiWidget } from "@/components/dashboard/KpiWidget";
import { TableWidget } from "@/components/dashboard/TableWidget";
import { GaugeWidget } from "@/components/dashboard/GaugeWidget";
import { TreemapWidget } from "@/components/dashboard/TreemapWidget";
import { WordCloudWidget } from "@/components/dashboard/WordCloudWidget";
import { SankeyWidget } from "@/components/dashboard/SankeyWidget";
import { RibbonWidget } from "@/components/dashboard/RibbonWidget";
import { DecompositionTreeWidget } from "@/components/dashboard/DecompositionTreeWidget";
import { TextWidget } from "@/components/dashboard/TextWidget";
import { ClusteredColumnWidget } from "@/components/dashboard/ClusteredColumnWidget";
import { LineColumnComboWidget } from "@/components/dashboard/LineColumnComboWidget";
import { StackedAreaWidget } from "@/components/dashboard/StackedAreaWidget";
import { StackedBar100Widget } from "@/components/dashboard/StackedBar100Widget";
import { SunburstWidget } from "@/components/dashboard/SunburstWidget";
import { HeatmapWidget } from "@/components/dashboard/HeatmapWidget";
import { AdvancedBarWidget } from "@/components/dashboard/AdvancedBarWidget";
import { QueryBuilder } from "@/components/dashboard/QueryBuilder";
import { AddWidgetPanel } from "@/components/dashboard/AddWidgetPanel";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ScheduleReportDialog } from "@/components/dashboard/ScheduleReportDialog";
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilterBar";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import { executeAnalysis, getMockData, checkHealth } from "@/lib/tenable-api";
import { useDashboardStore } from "@/hooks/use-dashboard-store";
import { useToast } from "@/hooks/use-toast";

const ResponsiveGridLayout = WidthProvider(Responsive);

const WidgetCell = memo(function WidgetCell({
  widget,
  data,
  isLoading,
  renderWidget,
  onRemove,
  onEdit,
  isEditing,
}: {
  widget: Widget;
  data: Record<string, any>[];
  isLoading: boolean;
  renderWidget: (w: Widget, d: Record<string, any>[], loading: boolean) => React.ReactNode;
  onRemove: (id: string) => void;
  onEdit: (w: Widget) => void;
  isEditing: boolean;
}) {
  return (
    <WidgetWrapper widget={widget} onRemove={onRemove} onEdit={onEdit} isEditing={isEditing}>
      {renderWidget(widget, data, isLoading)}
    </WidgetWrapper>
  );
});

const Index = () => {
  const store = useDashboardStore();
  const { activeDashboard, dashboards } = store;

  const widgets = activeDashboard?.widgets || [];

  const [isEditing, setIsEditing] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, Record<string, any>[]>>({});
  const [loadingWidgets, setLoadingWidgets] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const { toast } = useToast();
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkHealth().then(setIsConnected);
  }, []);

  const loadWidgetData = useCallback(async (widget: Widget) => {
    if (!widget?.id || !activeDashboard) return;
    setLoadingWidgets(prev => new Set(prev).add(widget.id));
    try {
      const globalFilters = activeDashboard.globalFilters || [];
      const mergedQuery = {
        ...widget.query,
        filters: [
          ...widget.query.filters,
          ...globalFilters.filter(gf => gf.value.trim()).map(gf => ({
            id: gf.id,
            filterName: gf.filterName,
            operator: gf.operator,
            value: gf.value,
          })),
        ],
      };

      const effectiveTool = widget.type === "decomposition-tree" ? "listvuln" : widget.query.tool;
      const sourceTypes = widget.compareSourceTypes && widget.compareSourceTypes.length > 0
        ? widget.compareSourceTypes
        : null;

      if (isConnected) {
        if (sourceTypes) {
          const results = await Promise.all(
            sourceTypes.map(async (st) => {
              const stQuery = { ...mergedQuery, sourceType: st };
              const response = await executeAnalysis(stQuery);
              return { sourceType: st, results: response.response?.results || [] };
            })
          );
          const merged = results.flatMap(({ sourceType, results }) =>
            results.map(row => ({ ...row, __sourceType: sourceType }))
          );
          setWidgetData(prev => ({ ...prev, [widget.id]: merged }));
        } else {
          const effectiveQuery = widget.type === "decomposition-tree"
            ? { ...mergedQuery, tool: "listvuln" as any, endOffset: 200 }
            : mergedQuery;
          const response = await executeAnalysis(effectiveQuery);
          setWidgetData(prev => ({ ...prev, [widget.id]: response.response?.results || [] }));
        }
      } else {
        let mockResults = getMockData(effectiveTool);
        const allFilters = mergedQuery.filters;
        if (allFilters.length > 0) {
          mockResults = mockResults.filter(row => {
            return allFilters.every(f => {
              const filterVal = f.value.trim().toLowerCase();
              if (!filterVal) return true;
              
              if (f.filterName === "universal") {
                const searchableText = [
                  row.pluginName, row.ip, row.dnsName, row.pluginID, row.cveID,
                  row.operatingSystem, row.riskFactor,
                  typeof row.severity === "object" ? (row.severity as any).name : "",
                  typeof row.family === "object" ? (row.family as any).name : "",
                ].join(" ").toLowerCase();
                return searchableText.includes(filterVal);
              }

              let rowVal: any = row[f.filterName];
              if (rowVal && typeof rowVal === "object") {
                if (f.filterName === "severity") {
                  const allowedSevIds = filterVal.split(",");
                  const rowSevId = (rowVal.id ?? "").toString();
                  if (f.operator === "=") return allowedSevIds.includes(rowSevId);
                  if (f.operator === "!=") return !allowedSevIds.includes(rowSevId);
                }
                rowVal = (rowVal.name || rowVal.id || JSON.stringify(rowVal)).toString();
              } else {
                rowVal = (rowVal ?? "").toString();
              }
              
              const rowValLower = rowVal.toLowerCase();
              if (f.operator === "=") return rowValLower.includes(filterVal);
              if (f.operator === "!=") return !rowValLower.includes(filterVal);
              if (f.operator === ">=") return parseFloat(rowVal) >= parseFloat(filterVal);
              if (f.operator === "<=") return parseFloat(rowVal) <= parseFloat(filterVal);
              return rowValLower.includes(filterVal);
            });
          });
        }

        if (sourceTypes) {
          const tagged = sourceTypes.flatMap((st, stIdx) =>
            mockResults.map(row => ({
              ...row,
              __sourceType: st,
              count: String(Math.max(0, parseInt(row.count || "0") - (st === "patched" ? Math.floor(parseInt(row.count || "0") * 0.3) : stIdx * 5))),
            }))
          );
          setWidgetData(prev => ({ ...prev, [widget.id]: tagged }));
        } else {
          setWidgetData(prev => ({ ...prev, [widget.id]: mockResults }));
        }
      }
    } catch {
      setWidgetData(prev => ({ ...prev, [widget.id]: getMockData(widget.query.tool) }));
    } finally {
      setLoadingWidgets(prev => { const next = new Set(prev); next.delete(widget.id); return next; });
    }
  }, [isConnected, activeDashboard?.globalFilters, activeDashboard?.id]);

  const refreshAll = useCallback(() => {
    widgets.forEach(loadWidgetData);
  }, [widgets, loadWidgetData]);

  useEffect(() => {
    if (activeDashboard?.id) {
      refreshAll();
    }
  }, [activeDashboard?.id, activeDashboard?.globalFilters, refreshAll]);

  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    if (activeDashboard?.refreshInterval > 0) {
      refreshTimerRef.current = setInterval(refreshAll, activeDashboard.refreshInterval);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [activeDashboard?.refreshInterval, refreshAll]);

  const breakpointCols: Record<string, number> = { lg: 12, md: 10, sm: 6, xs: 4 };

  const layouts = useMemo(() => Object.fromEntries(
    Object.entries(breakpointCols).map(([bp, cols]) => [
      bp,
      widgets.map((w) => {
        const l = w.layout;
        const clampedW = Math.min(l.w, cols);
        const clampedX = Math.min(l.x, Math.max(0, cols - clampedW));
        return { ...l, w: clampedW, x: clampedX };
      }),
    ])
  ), [widgets]);

  const onLayoutChange = useCallback((layout: Layout) => {
    if (currentBreakpoint !== "lg") return;
    store.setWidgets((prev) =>
      prev.map((w) => {
        const l = layout.find((li: LayoutItem) => li.i === w.id);
        return l ? { ...w, layout: { ...w.layout, x: l.x, y: l.y, w: l.w, h: l.h } } : w;
      })
    );
  }, [store, currentBreakpoint]);

  const handleRemove = useCallback((id: string) => {
    store.removeWidget(id);
    setWidgetData(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, [store]);

  const handleEdit = useCallback((widget: Widget) => setEditingWidget(widget), []);

  const handleSaveWidget = useCallback((updated: Widget) => {
    store.updateWidget(updated);
    setEditingWidget(null);
    loadWidgetData(updated);
  }, [store, loadWidgetData]);

  const handleAddWidget = useCallback((type: WidgetType, title: string, tool: TenableVulnTool) => {
    const newWidget = store.addWidget(type, title, tool);
    loadWidgetData(newWidget);
  }, [store, loadWidgetData]);

  const handleExportPDF = useCallback(() => {
    document.body.classList.add("printing-dashboard");
    setTimeout(() => {
      window.print();
      document.body.classList.remove("printing-dashboard");
    }, 100);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!activeDashboard) return;
    const allData = Object.values(widgetData).flat();
    if (allData.length === 0) {
      toast({ title: "No data to export", description: "The dashboard is currently empty." });
      return;
    }
    const keys = Array.from(new Set(allData.flatMap(row => Object.keys(row))));
    const csvRows = [
      [`# ScanMan2 Dashboard Export: ${activeDashboard.name}`],
      [`# Generated: ${new Date().toLocaleString()}`],
      [],
      keys.map(k => `"${k}"`).join(","),
      ...allData.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ScanMan2_${activeDashboard.name.replace(/\s+/g, "_")}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  }, [widgetData, activeDashboard, toast]);

  const handleExportJSON = useCallback(() => {
    if (!activeDashboard) return;
    const data = {
      name: activeDashboard.name,
      widgets: activeDashboard.widgets,
      refreshInterval: activeDashboard.refreshInterval,
      exportedAt: new Date().toISOString(),
      version: 1,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeDashboard.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDashboard]);

  const handleImportJSON = useCallback((dashboard: Dashboard) => {
    store.importDashboard(dashboard);
    toast({ title: `Dashboard "${dashboard.name}" imported` });
  }, [store, toast]);

  const handleUpdateWidget = useCallback((updated: Widget) => {
    store.updateWidget(updated);
    loadWidgetData(updated);
  }, [store, loadWidgetData]);

  const renderWidget = useCallback((widget: Widget, data: Record<string, any>[], isLoading: boolean) => {
    if (!widget) return null;
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    const commonProps = {
      widget,
      data: data || [],
      onUpdate: handleUpdateWidget,
    };

    try {
      switch (widget.type) {
        case "kpi": return <KpiWidget {...commonProps} />;
        case "table": return <TableWidget {...commonProps} />;
        case "gauge": return <GaugeWidget {...commonProps} />;
        case "treemap": return <TreemapWidget {...commonProps} />;
        case "wordcloud": return <WordCloudWidget {...commonProps} />;
        case "sankey": return <SankeyWidget {...commonProps} />;
        case "ribbon": return <RibbonWidget {...commonProps} />;
        case "decomposition-tree": return <DecompositionTreeWidget {...commonProps} />;
        case "text": return <TextWidget {...commonProps} />;
        case "clustered-column": return <ClusteredColumnWidget {...commonProps} />;
        case "line-column-combo": return <LineColumnComboWidget {...commonProps} />;
        case "stacked-area": return <StackedAreaWidget {...commonProps} />;
        case "stacked-bar-100": return <StackedBar100Widget {...commonProps} />;
        case "sunburst": return <SunburstWidget {...commonProps} />;
        case "heatmap": return <HeatmapWidget {...commonProps} />;
        case "stacked-bar": return <AdvancedBarWidget {...commonProps} />;
        case "bar-negative": return <AdvancedBarWidget {...commonProps} />;
        default: return <ChartWidget {...commonProps} />;
      }
    } catch (err) {
      console.error("Widget render error:", err);
      return (
        <div className="h-full flex items-center justify-center text-destructive text-xs p-4 text-center">
          Error rendering {widget.title}
        </div>
      );
    }
  }, [handleUpdateWidget]);

  if (!activeDashboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground animate-pulse font-medium">Initializing Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="print-only-header">
        <h1>{activeDashboard.name}</h1>
        <div className="meta">Report Generated: {new Date().toLocaleString()} | ScanMan2</div>
      </div>

      <DashboardHeader
        dashboards={dashboards} activeDashboard={activeDashboard}
        onSwitchDashboard={store.setActiveId} onCreateDashboard={store.createDashboard}
        onDeleteDashboard={store.deleteDashboard} onRenameDashboard={store.renameDashboard}
        onRefreshAll={refreshAll} onSetRefreshInterval={store.setRefreshInterval}
        onExportCSV={handleExportCSV} onExportPDF={handleExportPDF}
        onExportJSON={handleExportJSON} onImportJSON={handleImportJSON}
        onShowSchedule={() => setShowScheduleDialog(true)}
        isEditing={isEditing} onToggleEditing={() => setIsEditing(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-success" : "bg-warning animate-pulse"}`} />
          <button onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors font-mono">
            {isConnected ? "Connected" : "Demo Mode"}
          </button>
          <AddWidgetPanel onAdd={handleAddWidget} />
        </div>
      </DashboardHeader>
      
      <DashboardFilterBar filters={activeDashboard.globalFilters || []} onChange={store.setGlobalFilters} />

      <main className="p-4">
        <ResponsiveGridLayout
          className="layout" layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
          cols={breakpointCols} rowHeight={80}
          onLayoutChange={onLayoutChange}
          onBreakpointChange={(bp: string) => setCurrentBreakpoint(bp)}
          draggableHandle=".drag-handle"
          isResizable={isEditing} isDraggable={isEditing}
          compactType="vertical" margin={[12, 12] as [number, number]}
        >
          {widgets.map((widget) => (
            <div key={widget.id}>
              <WidgetCell
                widget={widget}
                data={widgetData[widget.id] || []}
                isLoading={loadingWidgets.has(widget.id)}
                renderWidget={renderWidget}
                onRemove={handleRemove}
                onEdit={handleEdit}
                isEditing={isEditing}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      </main>

      {editingWidget && (
        <QueryBuilder widget={editingWidget} onSave={handleSaveWidget} onCancel={() => setEditingWidget(null)} isConnected={isConnected} />
      )}

      {showScheduleDialog && activeDashboard && (
        <ScheduleReportDialog 
          dashboard={activeDashboard} 
          onClose={() => setShowScheduleDialog(false)} 
        />
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onReconnect={() => checkHealth().then(setIsConnected)} />}
    </div>
  );
};

export default Index;
