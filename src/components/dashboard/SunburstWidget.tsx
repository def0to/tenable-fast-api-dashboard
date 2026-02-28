import { Widget } from "@/types/dashboard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { smartTransform, SEVERITY_COLORS, CHART_COLORS } from "@/lib/chart-data-utils";

interface SunburstWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

/**
 * Sunburst-style hierarchical chart using nested Pie charts.
 * Level 1: Tool Summary (Inner)
 * Level 2: Top details/entities (Outer)
 */
export function SunburstWidget({ widget, data, onUpdate }: SunburstWidgetProps) {
  const { chartData } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 20);

  if (!chartData.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
        No data for sunburst
      </div>
    );
  }

  // Level 1: High-level buckets (e.g. Critical vs Others)
  const innerData = [
    { name: "Top 5", value: chartData.slice(0, 5).reduce((s, d) => s + (d.value || 0), 0), color: "hsl(var(--primary))" },
    { name: "Others", value: chartData.slice(5).reduce((s, d) => s + (d.value || 0), 0), color: "hsl(var(--muted))" },
  ].filter(d => d.value > 0);

  // Level 2: Detailed entities
  const outerData = chartData.map((d, i) => ({
    ...d,
    fill: SEVERITY_COLORS[d.name] || d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={innerData}
            dataKey="value"
            nameKey="name"
            cx="50%" cy="50%"
            innerRadius="0%"
            outerRadius="30%"
            isAnimationActive={false}
            stroke="hsl(var(--background))"
            strokeWidth={2}
          >
            {innerData.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.4} />
            ))}
          </Pie>
          <Pie
            data={outerData}
            dataKey="value"
            nameKey="name"
            cx="50%" cy="50%"
            innerRadius="35%"
            outerRadius="75%"
            isAnimationActive={false}
            stroke="hsl(var(--background))"
            strokeWidth={1}
            label={({ name, percent }) => (percent > 0.05 ? name : "")}
          >
            {outerData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload;
              return (
                <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl z-50">
                  <p className="text-[11px] font-bold text-foreground">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Value: <span className="text-foreground">{item.value?.toLocaleString()}</span>
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
