import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Dashboard, Widget, WidgetType, TenableVulnTool, TenableQueryConfig, DashboardFilter } from "@/types/dashboard";

const STORAGE_KEY = "scanman2_dashboards";
const ACTIVE_KEY = "scanman2_active_dashboard";

function defaultQuery(tool: TenableVulnTool = "listvuln"): TenableQueryConfig {
  return {
    type: "vuln",
    tool,
    sourceType: "cumulative",
    filters: [],
    sortField: "",
    sortDir: "DESC",
    startOffset: 0,
    endOffset: 50,
  };
}

function createDefaultDashboard(): Dashboard {
  return {
    id: "default",
    name: "Main Dashboard",
    widgets: [
      {
        id: "w1", type: "bar-chart", title: "Vulnerabilities by Severity",
        query: defaultQuery("sumseverity"),
        layout: { i: "w1", x: 0, y: 0, w: 6, h: 4, minW: 3, minH: 3 },
      },
      {
        id: "w2", type: "kpi", title: "Total Vulnerabilities",
        query: defaultQuery("sumseverity"),
        layout: { i: "w2", x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
      },
      {
        id: "w3", type: "pie-chart", title: "By Family", showValues: true,
        query: defaultQuery("sumfamily"),
        layout: { i: "w3", x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
      },
      {
        id: "w4", type: "gauge", title: "Risk Score",
        query: defaultQuery("sumseverity"),
        layout: { i: "w4", x: 0, y: 4, w: 3, h: 4, minW: 2, minH: 3 },
      },
      {
        id: "w5", type: "table", title: "Recent Vulnerabilities",
        query: defaultQuery("listvuln"),
        layout: { i: "w5", x: 3, y: 4, w: 9, h: 4, minW: 4, minH: 3 },
      },
    ],
    refreshInterval: 0,
    createdAt: Date.now(),
  };
}

function loadDashboards(): Dashboard[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return [createDefaultDashboard()];
}

function saveDashboards(dashboards: Dashboard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboards));
}

function loadActiveId(): string {
  return localStorage.getItem(ACTIVE_KEY) || "default";
}

export function useDashboardStore() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(() => {
    const loaded = loadDashboards();
    return loaded.length > 0 ? loaded : [createDefaultDashboard()];
  });
  
  const [activeId, setActiveIdState] = useState<string>(() => {
    const id = loadActiveId();
    // Ensure the activeId exists in the loaded dashboards
    const loaded = loadDashboards();
    if (loaded.find(d => d.id === id)) return id;
    return loaded[0]?.id || "default";
  });

  const activeDashboard = useMemo(() => {
    return dashboards.find(d => d.id === activeId) || dashboards[0];
  }, [dashboards, activeId]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveDashboards(dashboards);
      saveTimeoutRef.current = null;
    }, 300);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [dashboards]);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const updateDashboard = useCallback((updated: Dashboard) => {
    setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
  }, []);

  const createDashboard = useCallback((name: string) => {
    const newDash: Dashboard = {
      id: `dash-${Date.now()}`,
      name,
      widgets: [],
      refreshInterval: 0,
      createdAt: Date.now(),
    };
    setDashboards(prev => [...prev, newDash]);
    setActiveId(newDash.id);
    return newDash;
  }, [setActiveId]);

  const deleteDashboard = useCallback((id: string) => {
    setDashboards(prev => {
      const filtered = prev.filter(d => d.id !== id);
      if (filtered.length === 0) return [createDefaultDashboard()];
      return filtered;
    });
    if (activeId === id) {
      setActiveId(dashboards[0]?.id || "default");
    }
  }, [activeId, dashboards, setActiveId]);

  const renameDashboard = useCallback((id: string, name: string) => {
    setDashboards(prev => prev.map(d => d.id === id ? { ...d, name } : d));
  }, []);

  const setRefreshInterval = useCallback((interval: number) => {
    setDashboards(prev => prev.map(d => d.id === activeId ? { ...d, refreshInterval: interval } : d));
  }, [activeId]);

  const setGlobalFilters = useCallback((filters: DashboardFilter[]) => {
    setDashboards(prev => prev.map(d => d.id === activeId ? { ...d, globalFilters: filters } : d));
  }, [activeId]);

  const setWidgets = useCallback((updater: (prev: Widget[]) => Widget[]) => {
    setDashboards(prev => prev.map(d =>
      d.id === activeId ? { ...d, widgets: updater(d.widgets) } : d
    ));
  }, [activeId]);

  const addWidget = useCallback((type: WidgetType, title: string, tool: TenableVulnTool): Widget => {
    const id = `w-${Date.now()}`;
    const newWidget: Widget = {
      id, type, title,
      query: defaultQuery(tool),
      layout: { i: id, x: 0, y: Infinity, w: type === "kpi" || type === "gauge" ? 3 : type === "text" ? 4 : 4, h: type === "text" ? 3 : 4, minW: 2, minH: 2 },
      showValues: type === "pie-chart",
    };
    setWidgets(prev => [...prev, newWidget]);
    return newWidget;
  }, [setWidgets]);

  const removeWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  }, [setWidgets]);

  const updateWidget = useCallback((updated: Widget) => {
    setWidgets(prev => prev.map(w => w.id === updated.id ? updated : w));
  }, [setWidgets]);

  const importDashboard = useCallback((dashboard: Dashboard) => {
    setDashboards(prev => [...prev, dashboard]);
    setActiveId(dashboard.id);
  }, [setActiveId]);

  return {
    dashboards,
    activeDashboard,
    activeId,
    setActiveId,
    createDashboard,
    deleteDashboard,
    renameDashboard,
    setRefreshInterval,
    setGlobalFilters,
    setWidgets,
    addWidget,
    removeWidget,
    updateWidget,
    importDashboard,
  };
}
