import { useState } from "react";
import { Widget } from "@/types/dashboard";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { smartTransform, CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { TimeRange, filterByTimeRange } from "@/lib/time-range-utils";

interface LineColumnComboWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function LineColumnComboWidget({ widget, data, onUpdate }: LineColumnComboWidgetProps) {
  const timeRange = (widget.query.timeRange || "ALL") as TimeRange;
  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 15);
  const filteredData = filterByTimeRange(chartData, timeRange);

  const handleTimeRangeChange = (range: TimeRange) => {
    if (onUpdate) {
      onUpdate({
        ...widget,
        query: { ...widget.query, timeRange: range }
      });
    }
  };

  if (!filteredData.length) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-end mb-1">
          <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No data for combo chart
        </div>
      </div>
    );
  }

  const barKey = valueKeys[0];
  let sum = 0;
  const enriched = filteredData.map((d, i) => {
    const val = d[barKey] || d.value || 0;
    sum += val;
    return { ...d, __trend: Math.round(sum / (i + 1)) };
  });

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end mb-1">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={enriched} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 16%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }} axisLine={{ stroke: "hsl(222, 20%, 16%)" }} />
            <YAxis tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }} axisLine={{ stroke: "hsl(222, 20%, 16%)" }} />
            <Tooltip
              isAnimationActive={false}
              content={({ active, payload, label }) => {
                if (!active || !payload) return null;
                return (
                  <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-lg">
                    <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                    {payload.map((p: any, i: number) => (
                      <p key={i} className="text-xs" style={{ color: p.color }}>
                        {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={barKey} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} name="Count" isAnimationActive={false}>
              {enriched.map((entry: any, index: number) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || SEVERITY_COLORS[entry.name] || CHART_COLORS[0]} 
                />
              ))}
            </Bar>
            <Line type="monotone" dataKey="__trend" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} name="Avg" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
