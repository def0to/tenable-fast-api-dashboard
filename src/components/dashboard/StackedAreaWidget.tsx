import { useState } from "react";
import { Widget } from "@/types/dashboard";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { smartTransform, CHART_COLORS, SEVERITY_COLORS } from "@/lib/chart-data-utils";
import { TimeRangeSelector } from "./TimeRangeSelector";
import { TimeRange, filterByTimeRange } from "@/lib/time-range-utils";

interface StackedAreaWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

export function StackedAreaWidget({ widget, data, onUpdate }: StackedAreaWidgetProps) {
  const timeRange = (widget.query.timeRange || "ALL") as TimeRange;
  const { chartData, valueKeys } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 20);
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
          No data for stacked area
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end mb-1">
        <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} stackOffset={valueKeys.length > 1 ? "expand" : "none"}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 20%, 16%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 50%)", fontSize: 10 }} axisLine={{ stroke: "hsl(222, 20%, 16%)" }} />
            <YAxis
              tickFormatter={valueKeys.length > 1 ? (v) => `${(v * 100).toFixed(0)}%` : undefined}
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
                        {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {valueKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="1"
                stroke={SEVERITY_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length]}
                fill={SEVERITY_COLORS[key] || CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.7}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
