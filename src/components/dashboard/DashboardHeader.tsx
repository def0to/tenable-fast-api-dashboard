import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  RefreshCw,
  Download,
  Upload,
  Maximize,
  Plus,
  ChevronDown,
  Trash2,
  Pencil,
  Clock,
  Palette,
  Lock,
  Unlock,
  Mail,
} from "lucide-react";
import { Dashboard, REFRESH_INTERVALS } from "@/types/dashboard";
import { ScheduleReportDialog } from "./ScheduleReportDialog";

interface DashboardHeaderProps {
  dashboards: Dashboard[];
  activeDashboard: Dashboard;
  onSwitchDashboard: (id: string) => void;
  onCreateDashboard: (name: string) => void;
  onDeleteDashboard: (id: string) => void;
  onRenameDashboard: (id: string, name: string) => void;
  onRefreshAll: () => void;
  onSetRefreshInterval: (ms: number) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onExportJSON: () => void;
  onImportJSON: (dashboard: Dashboard) => void;
  onShowSchedule?: () => void;
  isEditing?: boolean;
  onToggleEditing?: () => void;
  children?: React.ReactNode;
}

export function DashboardHeader({
  dashboards,
  activeDashboard,
  onSwitchDashboard,
  onCreateDashboard,
  onDeleteDashboard,
  onRenameDashboard,
  onRefreshAll,
  onSetRefreshInterval,
  onExportCSV,
  onExportPDF,
  onExportJSON,
  onImportJSON,
  onShowSchedule,
  isEditing = false,
  onToggleEditing,
  children,
}: DashboardHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDashMenu, setShowDashMenu] = useState(false);
  const [showRefreshMenu, setShowRefreshMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("scanman2_theme") || "dark");

  useEffect(() => {
    // Optimization: disable transitions temporarily during theme switch to prevent lag
    const css = document.createElement("style");
    css.type = "text/css";
    css.appendChild(
      document.createTextNode(
        `* {
           -webkit-transition: none !important;
           -moz-transition: none !important;
           -o-transition: none !important;
           -ms-transition: none !important;
           transition: none !important;
        }`
      )
    );
    document.head.appendChild(css);

    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("scanman2_theme", theme);

    // Force a reflow
    const _ = window.getComputedStyle(css).opacity;
    
    // Remove the style tag after a brief delay
    setTimeout(() => {
      document.head.removeChild(css);
    }, 20);
  }, [theme]);

  const THEMES = [
    { id: "radix-indigo", label: "Indigo", desc: "Classic Radix depth" },
    { id: "radix-violet", label: "Violet", desc: "Mystical purple blend" },
    { id: "radix-crimson", label: "Crimson", desc: "Deep ruby energy" },
    { id: "radix-jade", label: "Jade", desc: "Serene emerald forest" },
    { id: "radix-amber", label: "Amber", desc: "Warm golden glow" },
    { id: "radix-cyan", label: "Cyan", desc: "Cool electric breeze" },
    { id: "royal-velvet", label: "Royal Velvet", desc: "Premium berry glass" },
    { id: "cyberpunk", label: "Cyberpunk", desc: "Neon glows & obsidian" },
    { id: "glass", label: "Frosted Glass", desc: "Soft translucent dark" },
    { id: "midnight", label: "Midnight", desc: "Absolute black" },
    { id: "dark", label: "Slate Dark", desc: "Professional gray" },
    { id: "light", label: "Crystal Light", desc: "Clean & airy" },
  ];

  const currentInterval = REFRESH_INTERVALS.find((r) => r.value === activeDashboard.refreshInterval);

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground tracking-tight">ScanMan2</h1>
        </div>

        {/* Dashboard selector */}
        <div className="relative">
          <button
            onClick={() => setShowDashMenu(!showDashMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
          >
            {activeDashboard.name}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {showDashMenu && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-xl z-50">
              <div className="p-1 max-h-60 overflow-y-auto">
                {dashboards.map((d) => (
                  <div key={d.id} className="group flex items-center gap-1">
                    {renamingId === d.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          onRenameDashboard(d.id, renameValue);
                          setRenamingId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRenameDashboard(d.id, renameValue);
                            setRenamingId(null);
                          }
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-secondary border border-primary rounded text-foreground"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            onSwitchDashboard(d.id);
                            setShowDashMenu(false);
                          }}
                          className={`flex-1 text-left px-3 py-2 text-sm rounded-md transition-colors ${
                            d.id === activeDashboard.id
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-secondary"
                          }`}
                        >
                          {d.name}
                          <span className="ml-2 text-[10px] text-muted-foreground">{d.widgets.length}w</span>
                        </button>
                        <button
                          onClick={() => {
                            setRenamingId(d.id);
                            setRenameValue(d.name);
                          }}
                          className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {dashboards.length > 1 && (
                          <button
                            onClick={() => onDeleteDashboard(d.id)}
                            className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-1">
                {creating ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newName.trim()) {
                          onCreateDashboard(newName.trim());
                          setCreating(false);
                          setNewName("");
                          setShowDashMenu(false);
                        }
                      }}
                      placeholder="Dashboard name"
                      className="flex-1 px-2 py-1.5 text-sm bg-secondary border border-border rounded text-foreground"
                    />
                    <button
                      onClick={() => {
                        if (newName.trim()) {
                          onCreateDashboard(newName.trim());
                          setCreating(false);
                          setNewName("");
                          setShowDashMenu(false);
                        }
                      }}
                      className="px-2 py-1.5 text-xs bg-primary text-primary-foreground rounded"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Dashboard
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {activeDashboard.widgets.length} widgets
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* Refresh */}
        <button
          onClick={onRefreshAll}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Refresh now"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Auto-refresh interval */}
        <div className="relative">
          <button
            onClick={() => setShowRefreshMenu(!showRefreshMenu)}
            className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
              activeDashboard.refreshInterval > 0
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title="Auto-refresh"
          >
            <Clock className="w-3.5 h-3.5" />
            {currentInterval && currentInterval.value > 0 ? currentInterval.label : ""}
          </button>
          {showRefreshMenu && (
            <div className="absolute top-full right-0 mt-1 w-36 bg-card border border-border rounded-lg shadow-xl z-50 p-1">
              {REFRESH_INTERVALS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => {
                    onSetRefreshInterval(r.value);
                    setShowRefreshMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors ${
                    r.value === activeDashboard.refreshInterval
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          {showExportMenu && (
            <div className="absolute top-full right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-xl z-50 p-1">
              <button
                onClick={() => {
                  onExportCSV();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-secondary rounded-md"
              >
                Export as CSV
              </button>
              <button
                onClick={() => {
                  onExportPDF();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-secondary rounded-md"
              >
                Export as PDF
              </button>
              <button
                onClick={() => {
                  onShowSchedule?.();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-secondary rounded-md flex items-center gap-1.5"
              >
                <Mail className="w-3 h-3" /> Schedule Report (Email)
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onExportJSON();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-secondary rounded-md"
              >
                Export Dashboard (JSON)
              </button>
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowExportMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-secondary rounded-md flex items-center gap-1.5"
              >
                <Upload className="w-3 h-3" /> Import Dashboard (JSON)
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const data = JSON.parse(ev.target?.result as string);
                      const dashboard: Dashboard = {
                        id: `dash-${Date.now()}`,
                        name: data.name || file.name.replace(".json", ""),
                        widgets: data.widgets || [],
                        refreshInterval: data.refreshInterval || 0,
                        createdAt: Date.now(),
                      };
                      onImportJSON(dashboard);
                    } catch {
                      alert("Invalid JSON file");
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>

        {/* Theme switcher */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Theme"
          >
            <Palette className="w-4 h-4" />
          </button>
          {showThemeMenu && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-50 p-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id);
                    setShowThemeMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors ${
                    theme === t.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{t.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Fullscreen"
          onClick={() => document.documentElement.requestFullscreen?.()}
        >
          <Maximize className="w-4 h-4" />
        </button>
        {onToggleEditing && (
          <button
            onClick={onToggleEditing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
              isEditing
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title={isEditing ? "Lock dashboard" : "Unlock to edit"}
          >
            {isEditing ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {isEditing ? "Editing" : "Locked"}
          </button>
        )}
        {children}
      </div>
    </header>
  );
}
