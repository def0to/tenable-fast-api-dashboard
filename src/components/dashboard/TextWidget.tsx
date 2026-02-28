import { Widget } from "@/types/dashboard";

interface TextWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

function replacePlaceholders(text: string, data: Record<string, any>[]): string {
  return text.replace(/\{(\w+)(?::(\w+))?\}/g, (match, field, agg) => {
    if (!data.length) return match;
    if (agg === "sum" || (!agg && data.length > 1)) {
      const sum = data.reduce((acc, row) => acc + (parseFloat(row[field]) || 0), 0);
      return sum.toLocaleString();
    }
    if (agg === "count") return data.length.toLocaleString();
    if (agg === "avg") {
      const sum = data.reduce((acc, row) => acc + (parseFloat(row[field]) || 0), 0);
      return (sum / data.length).toFixed(1);
    }
    // Single value
    const val = data[0]?.[field];
    if (val === undefined) return match;
    return typeof val === "object" ? JSON.stringify(val) : String(val);
  });
}

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Headers
    if (line.startsWith("### ")) return <h3 key={i} className="text-base font-semibold text-foreground mt-2">{line.slice(4)}</h3>;
    if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-foreground mt-2">{line.slice(3)}</h2>;
    if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-bold text-foreground mt-2">{line.slice(2)}</h1>;
    // List items
    if (line.startsWith("- ")) return <li key={i} className="text-sm text-foreground ml-4 list-disc">{renderInline(line.slice(2))}</li>;
    // Empty line
    if (!line.trim()) return <br key={i} />;
    // Normal paragraph
    return <p key={i} className="text-sm text-foreground">{renderInline(line)}</p>;
  });
}

function renderInline(text: string) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function TextWidget({ widget, data, onUpdate }: TextWidgetProps) {
  const content = widget.textContent || "Double-click to edit text.\n\nUse {field} for dynamic values.";
  const processed = replacePlaceholders(content, data);

  return (
    <div className="h-full overflow-auto p-3">
      {renderFormattedText(processed)}
    </div>
  );
}
