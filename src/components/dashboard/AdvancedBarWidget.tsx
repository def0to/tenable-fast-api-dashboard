import { Widget } from "@/types/dashboard";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, ReferenceLine, LabelList 
} from "recharts";
import { smartTransform, SEVERITY_COLORS, CHART_COLORS } from "@/lib/chart-data-utils";

interface AdvancedBarWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function AdvancedBarWidget({ widget, data, onUpdate }: AdvancedBarWidgetProps) {
  const isDivergent = widget.type === "bar-negative";
  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 15);

  if (!chartData.length) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">No data for chart</div>;
  }

  // Pre-process data for divergent (negative) view
  const processedData = isDivergent 
    ? chartData.map(d => {
        const row = { ...d };
        // If we have comparison data, make 'patched' negative
        if (row.__sourceType === "patched") {
          row.value = -(row.value || 0);
          valueKeys.forEach(k => { if (typeof row[k] === "number") row[k] = -row[k]; });
        }
        return row;
      })
    : chartData;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={processedData} 
        layout={isDivergent ? "vertical" : "horizontal"}
        stackOffset={isDivergent ? "sign" : "none"}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
        
        {isDivergent ? (
          <>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
          </>
        )}

        <Tooltip 
          isAnimationActive={false}
          cursor={{ fill: "hsl(var(--primary) / 0.05)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl z-50">
                <p className="text-[11px] font-bold text-foreground mb-1">{label}</p>
                {payload.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-4 text-[10px]">
                    <span className="flex items-center gap-1.5" style={{ color: p.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}:
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {Math.abs(Number(p.value)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
        
        {isDivergent && <ReferenceLine x={0} stroke="hsl(var(--foreground) / 0.5)" />}

        {valueKeys.map((key, i) => {
          const color = SEVERITY_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length];
          // ECharts style: mix of stacked and standalone
          // We'll stack everything by default but allow "Total" to be standalone
          const stackId = (key === "count" || key === "value" || key === "total") ? undefined : "a";
          
          return (
            <Bar 
              key={key} 
              dataKey={key} 
              fill={color} 
              stackId={stackId}
              isAnimationActive={false}
              radius={isDivergent ? [0, 2, 2, 0] : [2, 2, 0, 0]}
            >
              {processedData.map((entry: any, index: number) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || SEVERITY_COLORS[entry.name] || color} 
                  fillOpacity={entry.__sourceType === "patched" ? 0.6 : 1}
                />
              ))}
            </Bar>
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
