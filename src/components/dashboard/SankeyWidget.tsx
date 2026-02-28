import { Widget } from "@/types/dashboard";
import { smartTransform, SEVERITY_COLORS, CHART_COLORS, extractLabel } from "@/lib/chart-data-utils";

interface SankeyWidgetProps {
  widget: Widget;
  data: Record<string, any>[];
  onUpdate?: (widget: Widget) => void;
}

interface SankeyNode {
  name: string;
  color: string;
  value: number;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  color: string;
}

function buildSankeyData(data: Record<string, any>[], tool: string) {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const nodeMap = new Map<string, number>();

  const getOrCreateNode = (name: string, color?: string) => {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, nodes.length);
      nodes.push({ name, color: color || CHART_COLORS[nodes.length % CHART_COLORS.length], value: 0 });
    }
    return nodeMap.get(name)!;
  };

  if (tool === "listvuln" || tool === "vulndetails" || tool === "vulnipdetail" || tool === "vulnipsummary") {
    // Severity → Family flow
    const flowMap = new Map<string, number>();
    data.forEach(r => {
      const sev = r.severity?.name || "Unknown";
      const family = r.family?.name || "Unknown";
      const key = `${sev}|||${family}`;
      flowMap.set(key, (flowMap.get(key) || 0) + 1);
    });

    flowMap.forEach((value, key) => {
      const [sev, family] = key.split("|||");
      const sourceIdx = getOrCreateNode(sev, SEVERITY_COLORS[sev]);
      const targetIdx = getOrCreateNode(family);
      nodes[sourceIdx].value += value;
      nodes[targetIdx].value += value;
      links.push({ source: sourceIdx, target: targetIdx, value, color: SEVERITY_COLORS[sev] || CHART_COLORS[0] });
    });
  } else if (tool === "sumip") {
    // IP → Severity flow
    data.slice(0, 10).forEach(r => {
      const ip = r.ip || "Unknown";
      const ipIdx = getOrCreateNode(ip);
      const sevs = [
        { name: "Critical", val: parseInt(r.severityCritical || "0") },
        { name: "High", val: parseInt(r.severityHigh || "0") },
        { name: "Medium", val: parseInt(r.severityMedium || "0") },
        { name: "Low", val: parseInt(r.severityLow || "0") },
      ].filter(s => s.val > 0);

      sevs.forEach(s => {
        const targetIdx = getOrCreateNode(s.name, SEVERITY_COLORS[s.name]);
        nodes[ipIdx].value += s.val;
        nodes[targetIdx].value += s.val;
        links.push({ source: ipIdx, target: targetIdx, value: s.val, color: SEVERITY_COLORS[s.name] || CHART_COLORS[0] });
      });
    });
  } else {
    // Generic: use smartTransform to get categories, then flow All → each category
    const { chartData } = smartTransform(data, tool);
    const allIdx = getOrCreateNode("All");
    chartData.forEach(d => {
      const targetIdx = getOrCreateNode(d.name);
      const val = d.value || 0;
      nodes[allIdx].value += val;
      nodes[targetIdx].value += val;
      links.push({ source: allIdx, target: targetIdx, value: val, color: CHART_COLORS[targetIdx % CHART_COLORS.length] });
    });
  }

  return { nodes, links };
}

/**
 * Custom SVG Sankey implementation for better label visibility
 */
export function SankeyWidget({ widget, data, onUpdate }: SankeyWidgetProps) {
  const { nodes, links } = buildSankeyData(data, widget.query.tool);

  if (!nodes.length || !links.length) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Not enough data for Sankey diagram
      </div>
    );
  }

  // Separate source and target nodes
  const sourceSet = new Set(links.map(l => l.source));
  const targetSet = new Set(links.map(l => l.target));
  const sourceNodes = [...sourceSet].map(i => ({ ...nodes[i], idx: i }));
  const targetNodes = [...targetSet].filter(i => !sourceSet.has(i)).map(i => ({ ...nodes[i], idx: i }));

  // If all targets are also sources (cycle), split into left/right by first appearance
  if (targetNodes.length === 0) {
    // Fallback: first half as source, second half as target
    const half = Math.ceil(nodes.length / 2);
    return renderSvgSankey(
      nodes.slice(0, half).map((n, i) => ({ ...n, idx: i })),
      nodes.slice(half).map((n, i) => ({ ...n, idx: i + half })),
      links,
      nodes
    );
  }

  return renderSvgSankey(sourceNodes, targetNodes, links, nodes);
}

function renderSvgSankey(
  leftNodes: { name: string; color: string; value: number; idx: number }[],
  rightNodes: { name: string; color: string; value: number; idx: number }[],
  links: SankeyLink[],
  allNodes: SankeyNode[]
) {
  const padding = 8;
  const nodeWidth = 14;
  const leftX = 140;
  const rightX = 380;
  const viewWidth = 540;

  // Calculate positions
  const totalLeft = leftNodes.reduce((a, n) => a + n.value, 0) || 1;
  const totalRight = rightNodes.reduce((a, n) => a + n.value, 0) || 1;

  let leftY = padding;
  const leftPositions: Record<number, { y: number; h: number; usedY: number }> = {};
  leftNodes.forEach(n => {
    const h = Math.max(16, (n.value / totalLeft) * 280);
    leftPositions[n.idx] = { y: leftY, h, usedY: leftY };
    leftY += h + 4;
  });

  let rightY = padding;
  const rightPositions: Record<number, { y: number; h: number; usedY: number }> = {};
  rightNodes.forEach(n => {
    const h = Math.max(16, (n.value / totalRight) * 280);
    rightPositions[n.idx] = { y: rightY, h, usedY: rightY };
    rightY += h + 4;
  });

  const viewHeight = Math.max(leftY, rightY) + padding;

  // Sort links by value for better visibility
  const sortedLinks = [...links].sort((a, b) => b.value - a.value);

  return (
    <div className="h-full w-full overflow-hidden p-1">
      <svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* Links */}
        {sortedLinks.map((link, i) => {
          const src = leftPositions[link.source];
          const tgt = rightPositions[link.target];
          if (!src || !tgt) return null;

          const linkH = Math.max(2, (link.value / totalLeft) * 280);
          const srcY = src.usedY + linkH / 2;
          src.usedY += linkH;

          const tgtLinkH = Math.max(2, (link.value / totalRight) * 280);
          const tgtY = tgt.usedY + tgtLinkH / 2;
          tgt.usedY += tgtLinkH;

          const x1 = leftX + nodeWidth;
          const x2 = rightX;
          const cx = (x1 + x2) / 2;

          return (
            <path
              key={i}
              d={`M${x1},${srcY} C${cx},${srcY} ${cx},${tgtY} ${x2},${tgtY}`}
              fill="none"
              stroke={link.color}
              strokeWidth={Math.max(1.5, linkH * 0.6)}
              strokeOpacity={0.35}
            >
              <title>{allNodes[link.source]?.name} → {allNodes[link.target]?.name}: {link.value.toLocaleString()}</title>
            </path>
          );
        })}

        {/* Left nodes */}
        {leftNodes.map(n => {
          const pos = leftPositions[n.idx];
          return (
            <g key={`l-${n.idx}`}>
              <rect x={leftX} y={pos.y} width={nodeWidth} height={pos.h} fill={n.color} rx={3} />
              <text x={leftX - 6} y={pos.y + pos.h / 2} textAnchor="end" dominantBaseline="central"
                fill="hsl(215, 20%, 70%)" fontSize={11} fontWeight={500}>
                {n.name}
              </text>
              <text x={leftX - 6} y={pos.y + pos.h / 2 + 13} textAnchor="end" dominantBaseline="central"
                fill="hsl(215, 15%, 45%)" fontSize={9}>
                {n.value.toLocaleString()}
              </text>
            </g>
          );
        })}

        {/* Right nodes */}
        {rightNodes.map(n => {
          const pos = rightPositions[n.idx];
          return (
            <g key={`r-${n.idx}`}>
              <rect x={rightX} y={pos.y} width={nodeWidth} height={pos.h} fill={n.color} rx={3} />
              <text x={rightX + nodeWidth + 6} y={pos.y + pos.h / 2} textAnchor="start" dominantBaseline="central"
                fill="hsl(215, 20%, 70%)" fontSize={11} fontWeight={500}>
                {n.name}
              </text>
              <text x={rightX + nodeWidth + 6} y={pos.y + pos.h / 2 + 13} textAnchor="start" dominantBaseline="central"
                fill="hsl(215, 15%, 45%)" fontSize={9}>
                {n.value.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
