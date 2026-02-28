import { Widget } from "@/types/dashboard";
import { useMemo } from "react";
import { smartTransform, CHART_COLORS } from "@/lib/chart-data-utils";

interface WordCloudWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
}

interface WordItem {
  text: string;
  count: number;
  size: number;
  color: string;
}

export function WordCloudWidget({ widget, data }: WordCloudWidgetProps) {
  const words = useMemo((): WordItem[] => {
    const { chartData } = smartTransform(data, widget.query.tool, widget.xField, widget.yField, 40);
    if (!chartData.length) return [];

    const maxCount = Math.max(...chartData.map(d => d.value || 0), 1);
    const minCount = Math.min(...chartData.map(d => d.value || 0));
    const range = maxCount - minCount || 1;

    return chartData.map((d, i) => ({
      text: d.name,
      count: d.value || 0,
      size: 12 + ((d.value - minCount) / range) * 28,
      color: d.color || CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [data, widget.query.tool, widget.xField, widget.yField]);

  if (!words.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        No data for word cloud
      </div>
    );
  }

  return (
    <div className="h-full flex flex-wrap items-center justify-center gap-2 p-2 overflow-hidden">
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block cursor-default transition-transform hover:scale-110"
          style={{
            fontSize: `${word.size}px`,
            color: word.color,
            fontWeight: word.size > 25 ? 700 : word.size > 18 ? 600 : 400,
            opacity: 0.7 + (word.size - 12) / 28 * 0.3,
            lineHeight: 1.2,
          }}
          title={`${word.text}: ${word.count.toLocaleString()}`}
        >
          {word.text}
        </span>
      ))}
    </div>
  );
}
