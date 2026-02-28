import { ReactNode, useState } from "react";
import { Widget } from "@/types/dashboard";
import { Settings, Trash2, GripVertical } from "lucide-react";

interface WidgetWrapperProps {
  widget: Widget;
  children: ReactNode;
  onRemove: (id: string) => void;
  onEdit: (widget: Widget) => void;
  isEditing?: boolean;
}

export function WidgetWrapper({ widget, children, onRemove, onEdit, isEditing = false }: WidgetWrapperProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="h-full flex flex-col rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden transition-all duration-300 hover:border-primary/30"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50 min-h-[44px]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditing && <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0 drag-handle" />}
          <span className="text-sm font-medium text-foreground truncate">{widget.title}</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
            {widget.query.tool}
          </span>
        </div>
        {hovered && isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(widget); }}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(widget.id); }}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 overflow-auto">
        {children}
      </div>
    </div>
  );
}
