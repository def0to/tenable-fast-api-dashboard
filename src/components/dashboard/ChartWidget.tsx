import { useState, useMemo } from "react";
import { Widget } from "@/types/dashboard";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import { smartTransform, CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { TimeRange, filterByTimeRange, hasDateData } from "@/lib/time-range-utils";

interface ChartWidgetProps {
  widget: Widget;
  data: Record<string, unknown>[];
  onUpdate?: (widget: Widget) => void;
}

const TIME_RANGE_TYPES = new Set(["line-chart", "area-chart", "bar-chart", "stacked-area", "ribbon", "trend"]);

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number | string; color: string }[];
  label?: string;
}

export function ChartWidget({ widget, data, onUpdate }: ChartWidgetProps) {
  const timeRange = widget.query.timeRange || "ALL";
  const showLabels = widget.showLabels === true;
  const showPercentage = widget.showPercentage === true;

  const handleTimeRangeChange = (range: TimeRange) => {
    if (onUpdate) {
      onUpdate({
        ...widget,
        query: { ...widget.query, timeRange: range }
      });
    }
  };

  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 50);

  // For trend tools or specific charts, always show time range
  const isTrend = widget.query.tool === "trend";
  const showTimeRange = isTrend || TIME_RANGE_TYPES.has(widget.type);
  
  // Local filtering as a fallback if the API doesn't support it or for smoother UX
  const filteredData = showTimeRange && hasDateData(chartData) ? filterByTimeRange(chartData, timeRange as TimeRange) : chartData;

  // Calculate precision percentages for display without rounding the underlying data
  const displayData = filteredData;
  const grandTotal = useMemo(() => {
    return filteredData.reduce((sum, row) => {
      return sum + valueKeys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
    }, 0);
  }, [filteredData, valueKeys]);

  if (!displayData.length) {
    return (
      <div className="h-full flex flex-col">
        {showTimeRange && (
          <div className="flex justify-end mb-1">
            <TimeRangeSelector value={timeRange as TimeRange} onChange={handleTimeRangeChange} />
          </div>
        )}
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No data to chart
        </div>
      </div>
    );
  }

  const customTooltip = ({ active, payload, label }: TooltipProps) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg z-50">
        <p className="text-xs font-medium text-foreground mb-1">{label}</p>
        {payload.map((p, i) => {
          const rawValue = Number(p.value) || 0;
          const percentage = grandTotal > 0 ? ((rawValue / grandTotal) * 100).toFixed(1) : "0.0";
          
          return (
            <div key={i} className="flex items-center gap-4 justify-between text-xs">
              <span className="flex items-center gap-1.5" style={{ color: p.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}:
              </span>
              <span className="font-mono font-medium text-foreground">
                {rawValue.toLocaleString()}
                {showPercentage && <span className="ml-1 opacity-70">({percentage}%)</span>}
              </span>
            </div>
          );
        })}
        {!showPercentage && payload.length > 1 && (
          <div className="mt-1 pt-1 border-t border-border flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            <span>Total:</span>
            <span>{payload.reduce((s, p) => s + (Number(p.value) || 0), 0).toLocaleString()}</span>
          </div>
        )}
      </div>
    );
  };

  if (widget.type === "pie-chart") {
    const showPieLabels = widget.showValues !== false;
    const renderLabel = showPieLabels
      ? ({ name, value, percent, cx, cy, midAngle, outerRadius: or, innerRadius: ir }: { name: string; value: number; percent: number; cx: number; cy: number; midAngle: number; outerRadius: number; innerRadius: number }) => {
          const RADIAN = Math.PI / 180;
          const radius = ir + (or - ir) * 0.5 + or * 0.35;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          if (percent < 0.03) return null; // hide tiny slices
          const truncName = name?.length > 12 ? name.slice(0, 10) + "…" : name;
          const percentage = (percent * 100).toFixed(1);
          const label = showPercentage
            ? `${truncName}: ${percentage}%`
            : `${truncName}: ${value.toLocaleString()} (${percentage}%)`;
          return (
            <text x={x} y={y} fill="hsl(215, 15%, 70%)" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10}>
              {label}
            </text>
          );
        }
      : false;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
          <Pie
            data={displayData}
            dataKey={valueKeys[0]}
            nameKey="name"
            cx="50%" cy="50%"
            outerRadius="65%"
            innerRadius="35%"
            strokeWidth={0}
            label={renderLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {displayData.map((entry, i) => (
              <Cell key={i} fill={entry.color || `hsl(var(--chart-${(i % 5) + 1}))`} />
            ))}
          </Pie>
          <Tooltip content={customTooltip} isAnimationActive={false} />
          <Legend wrapperStyle={{ fontSize: 11, color: "hsl(215, 15%, 50%)" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const ChartComp = widget.type === "line-chart" ? LineChart : widget.type === "area-chart" ? AreaChart : BarChart;

  const renderBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (width < 20) return null;
    const percentage = grandTotal > 0 ? ((Number(value) / grandTotal) * 100).toFixed(1) : "0.0";
    const label = showPercentage ? `${percentage}%` : Number(value).toLocaleString();
    return (
      <text x={x + width / 2} y={y - 4} fill="hsl(215, 15%, 60%)" textAnchor="middle" fontSize={9}>
        {label}
      </text>
    );
  };

  const labelFormatter = (v: number) => {
    if (showPercentage) {
      return grandTotal > 0 ? `${((v / grandTotal) * 100).toFixed(1)}%` : "0.0%";
    }
    return v.toLocaleString();
  };

  return (
    <div className="h-full flex flex-col">
      {showTimeRange && (
        <div className="flex justify-end mb-1">
          <TimeRangeSelector value={timeRange as TimeRange} onChange={handleTimeRangeChange} />
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComp data={displayData} margin={{ top: showLabels ? 15 : 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 16%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 11 }} axisLine={{ stroke: "hsl(222, 20%, 16%)" }} />
            <YAxis
              tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 11 }}
              axisLine={{ stroke: "hsl(222, 20%, 16%)" }}
              tickFormatter={showPercentage ? (v) => grandTotal > 0 ? `${((v / grandTotal) * 100).toFixed(0)}%` : `${v}%` : undefined}
            />
            <Tooltip content={customTooltip} isAnimationActive={false} />
            {valueKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {valueKeys.map((key, i) => {
              const color = SEVERITY_COLORS[key] || `hsl(var(--chart-${(i % 5) + 1}))`;
              if (widget.type === "line-chart") {
                return (
                  <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={showLabels} isAnimationActive={false}>
                    {showLabels && <LabelList dataKey={key} position="top" fill="hsl(215, 15%, 60%)" fontSize={9} formatter={labelFormatter} />}
                  </Line>
                );
              }
              if (widget.type === "area-chart") {
                return (
                  <Area key={key} type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false}>
                    {showLabels && <LabelList dataKey={key} position="top" fill="hsl(215, 15%, 60%)" fontSize={9} formatter={labelFormatter} />}
                  </Area>
                );
              }
              return (
                <Bar key={key} dataKey={key} fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {showLabels && <LabelList dataKey={key} content={renderBarLabel} />}
                  {displayData.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color || SEVERITY_COLORS[entry.name] || color} 
                    />
                  ))}
                </Bar>
              );
            })}
          </ChartComp>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
