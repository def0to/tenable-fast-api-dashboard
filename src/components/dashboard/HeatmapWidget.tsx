import { Widget } from "@/types/dashboard";
import { ResponsiveContainer, Tooltip, XAxis, YAxis, ScatterChart, Scatter, Cell, ZAxis } from "recharts";
import { smartTransform, SEVERITY_COLORS, CHART_COLORS } from "@/lib/chart-data-utils";

interface HeatmapWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function HeatmapWidget({ widget, data, onUpdate }: HeatmapWidgetProps) {
  // Use a higher limit for heatmaps to see patterns
  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 100);

  if (!chartData.length) {
    return <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">No data for heatmap</div>;
  }

  // Transform flat data into X, Y, Z coordinates
  // X = Category (e.g. IP or Family), Y = Severity Level, Z = Count
  const plotData: any[] = [];
  const yLabels = ["Critical", "High", "Medium", "Low", "Info"];
  
  chartData.forEach((row, xIdx) => {
    yLabels.forEach((label, yIdx) => {
      const val = Number(row[label]) || 0;
      if (val > 0) {
        plotData.push({
          x: row.name,
          y: label,
          z: val,
          color: SEVERITY_COLORS[label] || CHART_COLORS[0],
          xIdx
        });
      }
    });
  });

  if (!plotData.length) {
    // Fallback for non-severity data: just plot the primary values
    chartData.forEach((row, xIdx) => {
      plotData.push({ x: row.name, y: "Total", z: row.value, color: CHART_COLORS[0], xIdx });
    });
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 40 }}>
        <XAxis 
          type="category" 
          dataKey="x" 
          name="Entity" 
          interval={0}
          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
          axisLine={{ stroke: "hsl(var(--border))" }}
        />
        <YAxis 
          type="category" 
          dataKey="y" 
          name="Severity" 
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={{ stroke: "hsl(var(--border))" }}
        />
        <ZAxis type="number" dataKey="z" range={[50, 400]} name="Count" />
        <Tooltip 
          isAnimationActive={false}
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl z-50">
                <p className="text-[11px] font-bold text-foreground">{d.x}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <p className="text-[10px] text-muted-foreground">
                    {d.y}: <span className="text-foreground font-bold">{d.z.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            );
          }}
        />
        <Scatter data={plotData} isAnimationActive={false}>
          {plotData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} stroke={entry.color} strokeWidth={1} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
