import { Widget } from "@/types/dashboard";
import { Treemap, ResponsiveContainer, Tooltip, Text } from "recharts";
import { smartTransform, CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";

interface TreemapWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

const CustomContent = (props: any) => {
  const { x, y, width, height, name, fill, value } = props;
  
  // Basic visibility check
  if (!width || !height || width < 10 || height < 10 || !fill) return null;

  // Safe color processing
  let safeFill = typeof fill === 'string' ? fill : CHART_COLORS[0];
  if (safeFill.includes("hsl")) {
    safeFill = safeFill.replace(")", ", 0.85)");
  }

  const displayValue = typeof value === 'number' ? value : 0;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={safeFill}
        stroke="hsl(var(--background))"
        strokeWidth={1}
        rx={2}
        style={{ transition: 'opacity 0.2s' }}
        className="hover:opacity-80 cursor-default"
      />
      {width > 30 && height > 25 && (
        <>
          {/* Top-aligned Label with heavy stroke for isolation */}
          <Text
            x={x + 5}
            y={y + 5}
            width={width - 10}
            fill="white"
            stroke="black"
            strokeWidth={2.5}
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize={Math.max(9, Math.min(12, width / 10))}
            fontWeight={800}
            verticalAnchor="start"
            className="select-none pointer-events-none"
            style={{ 
              filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,1))',
              letterSpacing: '-0.01em'
            }}
          >
            {name || "Unknown"}
          </Text>
          
          {/* Bottom-aligned Value to prevent overlap with the label above */}
          {height > 45 && (
            <Text
              x={x + 5}
              y={y + height - 5}
              width={width - 10}
              fill="white"
              stroke="black"
              strokeWidth={2}
              strokeLinejoin="round"
              paintOrder="stroke"
              fontSize={Math.max(8, 10)}
              fontWeight={700}
              verticalAnchor="end"
              className="select-none pointer-events-none font-mono opacity-90"
              style={{ filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,1))' }}
            >
              {displayValue.toLocaleString()}
            </Text>
          )}
        </>
      )}
    </g>
  );
};

export function TreemapWidget({ widget, data, onUpdate }: TreemapWidgetProps) {
  // Use a sensible limit for Treemaps
  const { chartData } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 50);

  // Recharts Treemap expects 'children' for hierarchy, or flat data with 'value'
  const treeData = (chartData || []).map((d, i) => ({
    name: String(d.name || "Unknown"),
    value: Math.max(0, Number(d.value) || 0),
    fill: SEVERITY_COLORS[d.name] || d.color || CHART_COLORS[i % CHART_COLORS.length],
  })).filter(d => d.value > 0);

  if (!treeData.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic p-4 text-center">
        No numeric data available for treemap distribution
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={treeData}
          dataKey="value"
          aspectRatio={4 / 3}
          stroke="hsl(var(--background))"
          content={<CustomContent />}
          isAnimationActive={false}
        >
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const item = payload[0]?.payload;
              if (!item) return null;
              
              return (
                <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-xl z-50">
                  <p className="text-[11px] font-bold text-foreground mb-1">{item.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Value: <span className="text-foreground font-bold">{Number(item.value || 0).toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
