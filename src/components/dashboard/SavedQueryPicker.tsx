import { useState, useEffect } from "react";
import { listSavedQueries, createSavedQuery, deleteSavedQuery } from "@/lib/tenable-api";
import { TenableSavedQuery, TenableFilter, VULN_FILTER_NAMES, FILTER_OPERATORS } from "@/types/dashboard";
import { Database, Plus, Trash2, ChevronDown, ChevronUp, Save, Loader2, X } from "lucide-react";

interface SavedQueryPickerProps {
  onSelectQuery: (query: TenableSavedQuery) => void;
  currentFilters: TenableFilter[];
  currentTool: string;
  isConnected: boolean;
}

export function SavedQueryPicker({ onSelectQuery, currentFilters, currentTool, isConnected }: SavedQueryPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [queries, setQueries] = useState<TenableSavedQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchQueries = async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const data = await listSavedQueries("vuln");
      const usable = data.response?.usable || [];
      setQueries(usable.map(q => ({ id: q.id, name: q.name, description: q.description })));
    } catch {
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && isConnected) fetchQueries();
  }, [expanded, isConnected]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createSavedQuery({
        name: newName.trim(),
        description: newDesc,
        tool: currentTool,
        filters: currentFilters.map(f => ({ filterName: f.filterName, operator: f.operator, value: f.value })),
      });
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      fetchQueries();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSavedQuery(id);
      setQueries(prev => prev.filter(q => q.id !== id));
    } catch {}
  };

  if (!isConnected) {
    return (
      <div className="border border-border rounded-md p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="w-3.5 h-3.5" />
          Saved Queries (connect to Tenable SC to use)
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5" />
          Saved Tenable Queries
          {queries.length > 0 && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{queries.length}</span>}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="border-t border-border p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : queries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No saved queries found</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {queries.map(q => (
                <div key={q.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => onSelectQuery(q)}
                    className="flex-1 text-left px-2 py-1.5 text-xs rounded-md hover:bg-secondary transition-colors text-foreground"
                  >
                    <span className="font-medium">{q.name}</span>
                    {q.description && <span className="block text-[10px] text-muted-foreground truncate">{q.description}</span>}
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create new query */}
          {showCreate ? (
            <div className="border-t border-border pt-2 space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Query name"
                className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground"
              />
              <input
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-2 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground"
              />
              <p className="text-[10px] text-muted-foreground">
                Will save current tool ({currentTool}) and {currentFilters.length} filter(s) to Tenable SC
              </p>
              <div className="flex gap-1">
                <button onClick={handleCreate} disabled={saving || !newName.trim()}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save to Tenable
                </button>
                <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
            >
              <Plus className="w-3 h-3" /> Save current as query
            </button>
          )}
        </div>
      )}
    </div>
  );
}
