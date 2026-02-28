import { Widget } from "@/types/dashboard";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, LabelList,
} from "recharts";
import { smartTransform, CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";

interface StackedBar100WidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function StackedBar100Widget({ widget, data, onUpdate }: StackedBar100WidgetProps) {
  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 20);

  if (!chartData.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No data for 100% stacked bar
      </div>
    );
  }

  // Convert values to percentages per row
  const percentData = chartData.map((row) => {
    const total = valueKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    const pctRow: Record<string, any> = { name: row.name };
    valueKeys.forEach((key) => {
      const raw = Number(row[key]) || 0;
      pctRow[key] = total > 0 ? Math.round((raw / total) * 100) : 0;
      pctRow[`${key}_raw`] = raw;
    });
    pctRow._total = total;
    return pctRow;
  });

  // If only one value key, aggregate by name and compute percentage of grand total
  const useAggregated = valueKeys.length === 1;
  let finalData = percentData;
  let finalKeys = valueKeys;

  if (useAggregated) {
    const grandTotal = chartData.reduce((sum, r) => sum + (Number(r[valueKeys[0]]) || 0), 0);
    finalData = chartData.slice(0, 15).map((row) => {
      const raw = Number(row[valueKeys[0]]) || 0;
      const pct = grandTotal > 0 ? Math.round((raw / grandTotal) * 100) : 0;
      return { name: row.name, percent: pct, raw, color: row.color };
    });
    finalKeys = ["percent"];
  }

  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (width < 28 || height < 14) return null;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
      >
        {value}%
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={finalData}
        layout="vertical"
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        stackOffset={useAggregated ? "none" : "expand"}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 16%)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${useAggregated ? v : Math.round(v * 100)}%`}
          tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
          axisLine={{ stroke: "hsl(222, 20%, 16%)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }}
          axisLine={{ stroke: "hsl(222, 20%, 16%)" }}
        />
        <Tooltip
          isAnimationActive={false}
          content={({ active, payload, label }) => {
            if (!active || !payload) return null;
            return (
              <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg">
                <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                  <p key={i} className="text-xs" style={{ color: p.color }}>
                    {p.name}: {p.payload[`${p.dataKey}_raw`] ?? p.value}
                    {useAggregated ? `%` : ` (${typeof p.value === "number" ? `${Math.round(p.value * 100)}%` : p.value})`}
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {finalKeys.map((key, i) => {
          const color = SEVERITY_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Bar key={key} dataKey={key} stackId="stack" fill={color} name={key} isAnimationActive={false}>
              <LabelList dataKey={key} content={renderCustomLabel} />
              {useAggregated && finalData.map((entry: any, idx: number) => (
                <Cell key={idx} fill={entry.color || SEVERITY_COLORS[entry.name] || CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
