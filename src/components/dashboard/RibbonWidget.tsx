import { Widget } from "@/types/dashboard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { smartTransform, CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";

interface RibbonWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function RibbonWidget({ widget, data, onUpdate }: RibbonWidgetProps) {
  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 15);

  if (!chartData.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
        No data for ribbon chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset="wiggle">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={{ stroke: "hsl(var(--border) / 0.5)" }} />
        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={{ stroke: "hsl(var(--border) / 0.5)" }} />
        <Tooltip
          isAnimationActive={false}
          content={({ active, payload, label }) => {
            if (!active || !payload) return null;
            return (
              <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl z-50">
                <p className="text-xs font-bold text-foreground mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-4 text-[10px]">
                    <span className="flex items-center gap-1.5" style={{ color: p.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}:
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {p.value?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {valueKeys.map((key, i) => (
          <Area
            key={key}
            type="monotoneX"
            dataKey={key}
            stackId="1"
            stroke={SEVERITY_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length]}
            fill={SEVERITY_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.6}
            strokeWidth={0}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
