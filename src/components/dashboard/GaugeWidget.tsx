import { Widget } from "@/types/dashboard";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { smartTransform } from "@/lib/chart-data-utils";

interface GaugeWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function GaugeWidget({ widget, data, onUpdate }: GaugeWidgetProps) {
  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No data
      </div>
    );
  }

  const tool = widget.query.tool;
  let value = 0;
  let max = 100;
  let label = "Score";

  if (tool === "sumseverity") {
    const total = data.reduce((acc, r) => acc + parseInt(r.count || "0"), 0);
    const critical = data.find(r => r.severity?.name === "Critical");
    const high = data.find(r => r.severity?.name === "High");
    const critCount = parseInt(critical?.count || "0");
    const highCount = parseInt(high?.count || "0");
    value = Math.min(100, Math.round((critCount * 10 + highCount * 5) / Math.max(total, 1) * 100));
    label = "Risk Score";
  } else {
    // Smart: derive a meaningful gauge value
    const { chartData } = smartTransform(data, tool, widget.xField, widget.yField);
    const total = chartData.reduce((acc, r) => acc + (r.value || 0), 0);
    const maxVal = Math.max(...chartData.map(r => r.value || 0), 1);
    value = Math.min(100, Math.round((maxVal / Math.max(total, 1)) * 100));
    max = 100;
    label = `${total.toLocaleString()} total`;
  }

  const getColor = (v: number) => {
    if (v >= 75) return "hsl(var(--destructive))";
    if (v >= 50) return "hsl(var(--warning))";
    if (v >= 25) return "hsl(var(--chart-4))";
    return "hsl(var(--success))";
  };

  const chartData = [{ name: label, value, fill: getColor(value) }];

  return (
    <div className="h-full flex flex-col items-center justify-center relative">
      <ResponsiveContainer width="100%" height="80%">
        <RadialBarChart
          cx="50%" cy="55%"
          innerRadius="60%" outerRadius="85%"
          startAngle={210} endAngle={-30}
          data={chartData}
          barSize={12}
        >
          <PolarAngleAxis type="number" domain={[0, max]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "hsl(var(--secondary))" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</span>
      </div>
    </div>
  );
}
