import { useState } from "react";
import { getApiBaseUrl, setApiBaseUrl, checkHealth } from "@/lib/tenable-api";
import { X, Server, CheckCircle, XCircle, Loader, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface SettingsPanelProps {
  onClose: () => void;
  onReconnect: () => void;
}

export function SettingsPanel({ onClose, onReconnect }: SettingsPanelProps) {
  const [url, setUrl] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const queryClient = useQueryClient();

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // Temporarily set and test
    const originalUrl = getApiBaseUrl();
    localStorage.setItem("scanman2_api_url", url.replace(/\/$/, ""));
    const ok = await checkHealth();
    setTestResult(ok);
    setTesting(false);
    // Revert if failed so we don't break current session
    if (!ok) {
      localStorage.setItem("scanman2_api_url", originalUrl);
    }
  };

  const handleSave = () => {
    setApiBaseUrl(url);
    onReconnect();
    onClose();
  };

  const handleReset = () => {
    if (confirm("This will clear all local dashboard settings, themes, and API configurations. Are you sure?")) {
      localStorage.clear();
      queryClient.clear();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-card border border-border rounded-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Application Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* API Configuration */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Network & API</h3>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">FastAPI Backend URL</label>
              <input
                value={url}
                onChange={(e) => { setUrl(e.target.value); setTestResult(null); }}
                placeholder="/api (default)"
                className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground font-mono focus:ring-1 focus:ring-primary outline-none"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">
                Use <code className="bg-muted px-1 rounded">/api</code> for Docker. Use <code className="bg-muted px-1 rounded">http://localhost:8000</code> for local dev.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleTest} disabled={testing}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded bg-secondary text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50">
                {testing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                Test Connection
              </button>
              {testResult === true && (
                <span className="flex items-center gap-1 text-[10px] text-success font-black uppercase"><CheckCircle className="w-3 h-3" /> Online</span>
              )}
              {testResult === false && (
                <span className="flex items-center gap-1 text-[10px] text-destructive font-black uppercase"><XCircle className="w-3 h-3" /> Offline</span>
              )}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Maintenance</h3>
            <div className="p-4 bg-destructive/5 border border-destructive/10 rounded-lg">
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                If the application shows a black screen or data is not loading after an update, resetting the local state usually fixes the issue.
              </p>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-tight bg-destructive/10 text-destructive border border-destructive/20 rounded hover:bg-destructive hover:text-white transition-all shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Local Data
              </button>
            </div>
          </div>

          {/* Pro Tips */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg space-y-2">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Production Tip</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Always run the frontend behind the Nginx proxy (Port 80) to avoid CORS issues and enable automated HTTPS.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleSave}
            className="px-6 py-2 text-sm font-black uppercase tracking-tight rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
