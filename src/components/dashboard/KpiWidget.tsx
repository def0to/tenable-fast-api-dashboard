import { Widget } from "@/types/dashboard";
import { TrendingDown, AlertTriangle } from "lucide-react";
import { smartTransform, extractNumber } from "@/lib/chart-data-utils";

interface KpiWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function KpiWidget({ widget, data, onUpdate }: KpiWidgetProps) {
  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No data
      </div>
    );
  }

  const tool = widget.query.tool;
  let displayValue: string;
  let subtitle: string;

  if (tool === "sumseverity") {
    const total = data.reduce((acc, r) => acc + parseInt(r.count || "0"), 0);
    const critical = data.find(r => r.severity?.name === "Critical");
    displayValue = total.toLocaleString();
    subtitle = `${critical ? parseInt(critical.count).toLocaleString() : "0"} critical`;
  } else if (tool === "sumip") {
    displayValue = data.length.toLocaleString();
    subtitle = "Affected hosts";
  } else if (tool === "sumfamily") {
    const total = data.reduce((acc, r) => acc + parseInt(r.count || "0"), 0);
    displayValue = total.toLocaleString();
    subtitle = `${data.length} families`;
  } else {
    // Smart: sum the numeric field or count records
    const { chartData } = smartTransform(data, tool, widget.xField, widget.yField);
    const total = chartData.reduce((acc, r) => acc + (r.value || 0), 0);
    displayValue = total > 0 ? total.toLocaleString() : data.length.toLocaleString();
    subtitle = `${chartData.length} items`;
  }

  const hasCritical = data.some(r => r.severity?.id === "4" || r.severity?.name === "Critical");

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{widget.title}</span>
      <span className="text-4xl font-bold text-foreground tracking-tight">{displayValue}</span>
      <div className={`flex items-center gap-1 text-xs font-medium ${hasCritical ? "text-destructive" : "text-success"}`}>
        {hasCritical ? <AlertTriangle className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {subtitle}
      </div>
    </div>
  );
}
