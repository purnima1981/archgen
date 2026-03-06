import React, { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeResizer,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
  MarkerType,
  BackgroundVariant,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/* ── Global styles for draw.io-like connection experience ── */
const rfStyles = document.createElement("style");
rfStyles.textContent = `
  /* Connection line while dragging */
  .react-flow__connection-line { stroke: #1a73e8 !important; stroke-width: 2.5 !important; stroke-dasharray: 6 3; }

  /* Handles: 1px invisible point so arrows connect flush to node edge */
  .react-flow__handle {
    width: 1px !important; height: 1px !important;
    min-width: 0 !important; min-height: 0 !important;
    background: transparent !important;
    border: none !important;
    border-radius: 50% !important;
    pointer-events: none !important;
    transition: all 0.15s !important;
    opacity: 0 !important;
  }

  /* On node hover: expand handles to visible blue dots for interaction */
  .react-flow__node:hover .react-flow__handle,
  .react-flow__node.selected .react-flow__handle {
    width: 10px !important; height: 10px !important;
    background: #4285f4 !important;
    border: 2px solid #fff !important;
    pointer-events: all !important;
    cursor: crosshair !important;
    box-shadow: 0 0 4px rgba(66,133,244,0.5);
    opacity: 1 !important;
  }

  /* Hover on individual handle: enlarge + brighten */
  .react-flow__node:hover .react-flow__handle:hover,
  .react-flow__node.selected .react-flow__handle:hover {
    width: 14px !important; height: 14px !important;
    background: #1a73e8 !important;
    box-shadow: 0 0 8px rgba(26,115,232,0.7);
  }

  /* While dragging a connection: expand all handles for targeting */
  .react-flow.connecting .react-flow__node .react-flow__handle {
    width: 10px !important; height: 10px !important;
    background: #90caf9 !important;
    border: 2px solid #fff !important;
    pointer-events: all !important;
    opacity: 0.6 !important;
  }
  .react-flow.connecting .react-flow__node:hover .react-flow__handle {
    background: #43a047 !important;
    opacity: 1 !important;
    width: 14px !important; height: 14px !important;
    box-shadow: 0 0 8px rgba(67,160,71,0.6);
  }

  /* Valid drop target */
  .react-flow__handle-valid {
    background: #43a047 !important;
    border: 2px solid #fff !important;
    opacity: 1 !important;
    width: 14px !important; height: 14px !important;
    box-shadow: 0 0 10px rgba(67,160,71,0.7) !important;
  }

  /* Node resizer handles */
  .react-flow__resize-control.handle {
    border-radius: 2px !important;
    width: 10px !important; height: 10px !important;
    background: #fff !important;
    border: 2px solid #1a73e8 !important;
  }
  .react-flow__resize-control.handle:hover {
    background: #1a73e8 !important;
  }
  .react-flow__resize-control.line {
    border-color: #1a73e8 !important;
  }

  /* Selected edge */
  .react-flow__edge.selected .react-flow__edge-path { stroke-width: 3.5px; }

`;
if (!document.getElementById("rf-arch-styles")) { rfStyles.id = "rf-arch-styles"; document.head.appendChild(rfStyles); }

/* ── Types (same as dashboard) ── */
interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
interface NodeStyle { bgColor?: string; borderColor?: string; labelColor?: string; labelSize?: number }
interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers" | "connectivity" | "external"; subZone?: string; x: number; y: number; details?: NodeDetails; style?: NodeStyle }
interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean; network?: string; vpcsc?: string; dlp?: string; keyRotation?: string; egressPolicy?: string; compliance?: string }
interface EdgeStyle { color?: string; width?: number; dash?: "solid" | "dashed" | "dotted"; arrowHead?: "arrow" | "arrowclosed" | "none" }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert"; sourceHandle?: string; targetHandle?: string; pathOffset?: number; style?: EdgeStyle }
interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
interface Phase { id: string; name: string; nodeIds: string[] }
interface OpsGroup { name: string; nodeIds: string[] }
interface Diagram { title: string; subtitle?: string; layout?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[]; phases?: Phase[]; opsGroup?: OpsGroup }

/* ── Icon helpers (same as dashboard) ── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let IC: IconEntry[] = [];
async function loadIcons() { if (IC.length) return; try { IC = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {} }
function iconUrl(n: string, h?: string): string | null {
  const l = (h || n).toLowerCase().trim();
  const byId = IC.find(i => i.id === l);
  if (byId) return byId.path.includes('/vendor/') ? `/icons/vendor/${byId.id}.svg` : `/icons/gcp/${byId.id}.svg`;
  const byName = IC.find(i => i.name.toLowerCase() === l);
  if (byName) return byName.path.includes('/vendor/') ? `/icons/vendor/${byName.id}.svg` : `/icons/gcp/${byName.id}.svg`;
  const byAlias = IC.find(i => i.aliases.some(a => a === l));
  if (byAlias) return byAlias.path.includes('/vendor/') ? `/icons/vendor/${byAlias.id}.svg` : `/icons/gcp/${byAlias.id}.svg`;
  const norm = l.replace(/[-_\s]/g, "").replace(/^cloud/, "");
  const byNorm = IC.find(i => i.id.replace(/[-_\s]/g, "").replace(/^cloud/, "") === norm);
  if (byNorm) return byNorm.path.includes('/vendor/') ? `/icons/vendor/${byNorm.id}.svg` : `/icons/gcp/${byNorm.id}.svg`;
  return null;
}

/* ── Category Colors ── */
const CAT: Record<string, { bg: string; border: string }> = {
  apigee_api_platform: { bg: "#e8eaf6", border: "#5c6bc0" }, pubsub: { bg: "#e3f2fd", border: "#1e88e5" },
  dataflow: { bg: "#e3f2fd", border: "#1565c0" }, bigquery: { bg: "#e3f2fd", border: "#1565c0" },
  cloud_run: { bg: "#e0f2f1", border: "#00897b" }, cloud_functions: { bg: "#e0f2f1", border: "#00897b" },
  looker: { bg: "#ede7f6", border: "#7e57c2" }, datastream: { bg: "#e3f2fd", border: "#1e88e5" },
  data_catalog: { bg: "#e3f2fd", border: "#1e88e5" }, cloud_storage: { bg: "#e8f5e9", border: "#43a047" },
  cloud_sql: { bg: "#e8f5e9", border: "#43a047" }, memorystore: { bg: "#e8f5e9", border: "#43a047" },
  cloud_vpn: { bg: "#fff8e1", border: "#f9a825" }, cloud_interconnect: { bg: "#fff8e1", border: "#f9a825" },
  cloud_natural_language_api: { bg: "#fce4ec", border: "#e53935" }, vertexai: { bg: "#f3e5f5", border: "#8e24aa" },
  document_ai: { bg: "#f3e5f5", border: "#8e24aa" }, cloud_monitoring: { bg: "#eceff1", border: "#546e7a" },
  cloud_logging: { bg: "#eceff1", border: "#546e7a" }, cloud_scheduler: { bg: "#eceff1", border: "#546e7a" },
  identity_platform: { bg: "#fff8e1", border: "#f9a825" },
  cloud_composer: { bg: "#e8f5e9", border: "#43a047" }, dataproc: { bg: "#e3f2fd", border: "#1565c0" },
  dataplex: { bg: "#e8f5e9", border: "#2e7d32" }, analytics_hub: { bg: "#e3f2fd", border: "#1565c0" },
  security_command_center: { bg: "#ffebee", border: "#c62828" },
  postgresql: { bg: "#e3f2fd", border: "#336791" }, mysql: { bg: "#e0f7fa", border: "#00758f" },
  oracle: { bg: "#fbe9e7", border: "#c74634" }, sqlserver: { bg: "#ffebee", border: "#cc2927" },
  mongodb: { bg: "#e8f5e9", border: "#001e2b" }, snowflake: { bg: "#e0f7fa", border: "#29b5e8" },
  teradata: { bg: "#fff3e0", border: "#f37440" }, redis: { bg: "#ffebee", border: "#dc382d" },
  alloydb: { bg: "#e3f2fd", border: "#1a73e8" },
  salesforce: { bg: "#e0f2f1", border: "#00a1e0" }, servicenow: { bg: "#e8f5e9", border: "#81b5a1" },
  workday: { bg: "#fff3e0", border: "#f5820d" }, sap: { bg: "#e3f2fd", border: "#0070f2" },
  atlassian: { bg: "#e3f2fd", border: "#0052cc" },
  kafka: { bg: "#eceff1", border: "#231f20" }, confluent: { bg: "#e8eaf6", border: "#173361" },
  cyberark: { bg: "#e3f2fd", border: "#00467f" }, wiz: { bg: "#e8eaf6", border: "#2462e4" },
  keeper: { bg: "#e3f2fd", border: "#0d47a1" }, entra_id: { bg: "#e3f2fd", border: "#0078d4" },
  splunk: { bg: "#e8f5e9", border: "#65a637" }, dynatrace: { bg: "#e3f2fd", border: "#1496ff" },
  datadog: { bg: "#ede7f6", border: "#632ca6" }, grafana: { bg: "#fff3e0", border: "#f46800" },
  pagerduty: { bg: "#e8f5e9", border: "#06ac38" },
  aws_s3: { bg: "#e8f5e9", border: "#3f8624" }, aws_rds: { bg: "#e3f2fd", border: "#2e73b8" },
  aws_kinesis: { bg: "#ede7f6", border: "#8c4fff" }, aws_redshift: { bg: "#ede7f6", border: "#8c4fff" },
  aws_lambda: { bg: "#fff3e0", border: "#ff9900" },
  external_users: { bg: "#e3f2fd", border: "#1565c0" }, internal_users: { bg: "#eceff1", border: "#546e7a" },
  admin_user: { bg: "#ffebee", border: "#b71c1c" }, developer: { bg: "#e0f2f1", border: "#37474f" },
  analyst: { bg: "#e0f2f1", border: "#00695c" },
  sftp_server: { bg: "#eceff1", border: "#455a64" }, rest_api: { bg: "#fff3e0", border: "#ff6f00" },
  onprem_server: { bg: "#eceff1", border: "#78909c" }, mainframe: { bg: "#eceff1", border: "#263238" },
  webhook: { bg: "#ffebee", border: "#c62828" }, slack: { bg: "#fff3e0", border: "#ecb22e" },
  github: { bg: "#eceff1", border: "#24292f" }, fivetran: { bg: "#e3f2fd", border: "#0073ff" },
  dbt: { bg: "#fbe9e7", border: "#ff694b" }, azure: { bg: "#e3f2fd", border: "#0078d4" },
};
const DEF_CAT = { bg: "#f5f5f5", border: "#bdbdbd" };
function getCat(ic?: string | null, nodeId?: string) {
  if (ic && CAT[ic]) return CAT[ic];
  return DEF_CAT;
}

/* ── Handle style: minimal inline — CSS handles the visual appearance ── */
const handleBase: React.CSSProperties = { zIndex: 10 };

/* ── Auto-pick best handle pair based on relative positions of source/target ── */
function bestHandles(
  sx: number, sy: number, tx: number, ty: number
): { sourceHandle: string; targetHandle: string } {
  const dx = tx - sx;
  const dy = ty - sy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: "right", targetHandle: "left" }
      : { sourceHandle: "left", targetHandle: "right" };
  } else {
    return dy >= 0
      ? { sourceHandle: "bottom", targetHandle: "top" }
      : { sourceHandle: "top", targetHandle: "bottom" };
  }
}

/* ── Node dimensions ── */
const NODE_SIZE = 110; // card size
const ICON_SIZE = 72;  // icon inside card

/* ── Custom Node Component ── */
function ArchNode({ data, selected }: NodeProps) {
  const { label, subtitle, iconSrc, cat, threats, nodeStyle } = data as any;
  const SEV: Record<string, string> = { critical: "#b71c1c", high: "#e53935", medium: "#fb8c00", low: "#fdd835" };
  const hasThreat = threats && threats.length > 0;
  const bg = nodeStyle?.bgColor || cat.bg;
  const borderCol = nodeStyle?.borderColor || cat.border;
  const labelCol = nodeStyle?.labelColor || "#222";
  const labelSz = nodeStyle?.labelSize || 12;

  return (
    <div style={{ position: "relative", width: NODE_SIZE, height: NODE_SIZE, textAlign: "center", cursor: "grab" }}>
      {/* ── 12 handles: 3 per side (quarter, center, three-quarter) ── */}
      <Handle type="source" position={Position.Top} id="top" style={handleBase} />
      <Handle type="source" position={Position.Top} id="top-l" style={{ ...handleBase, left: "25%" }} />
      <Handle type="source" position={Position.Top} id="top-r" style={{ ...handleBase, left: "75%" }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleBase} />
      <Handle type="source" position={Position.Bottom} id="bottom-l" style={{ ...handleBase, left: "25%" }} />
      <Handle type="source" position={Position.Bottom} id="bottom-r" style={{ ...handleBase, left: "75%" }} />
      <Handle type="source" position={Position.Left} id="left" style={handleBase} />
      <Handle type="source" position={Position.Left} id="left-t" style={{ ...handleBase, top: "25%" }} />
      <Handle type="source" position={Position.Left} id="left-b" style={{ ...handleBase, top: "75%" }} />
      <Handle type="source" position={Position.Right} id="right" style={handleBase} />
      <Handle type="source" position={Position.Right} id="right-t" style={{ ...handleBase, top: "25%" }} />
      <Handle type="source" position={Position.Right} id="right-b" style={{ ...handleBase, top: "75%" }} />

      {/* Node card */}
      <div style={{
        width: "100%",
        height: "100%",
        borderRadius: 16,
        background: bg,
        border: `${selected ? 3 : 2}px solid ${selected ? "#1a73e8" : borderCol}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: selected ? "0 0 0 4px rgba(26,115,232,0.25)" : "0 3px 12px rgba(0,0,0,0.1)",
        transition: "box-shadow 0.2s, border-color 0.2s",
      }}>
        {iconSrc ? (
          <img src={iconSrc} alt={label} style={{ width: ICON_SIZE, height: ICON_SIZE }} draggable={false} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 800, color: borderCol, letterSpacing: 0.5, opacity: 0.7, textTransform: "uppercase" }}>
            {label.length <= 10 ? label : label.split(/[\s\/]/)[0]}
          </span>
        )}
      </div>

      {hasThreat && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 0, height: 0,
          borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
          borderBottom: `18px solid ${SEV[threats[0].severity] || "#fb8c00"}`,
          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
        }}>
          <span style={{ position: "absolute", left: -4, top: 4, fontSize: 9, fontWeight: 900, color: "#fff" }}>!</span>
        </div>
      )}

      <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: NODE_SIZE + 20, textAlign: "center", paddingTop: 6, pointerEvents: "none" }}>
        <div style={{ fontSize: labelSz, fontWeight: 700, color: labelCol, lineHeight: 1.3, wordBreak: "break-word" }}>{label}</div>
        {subtitle && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

/* ── Zone group node ── */
function ZoneNode({ data, selected }: NodeProps) {
  const { label, color, dashed, isGcp } = data as any;

  return (
    <div style={{
      width: "100%",
      height: "100%",
      borderRadius: isGcp ? 16 : 12,
      border: `${isGcp ? 2.5 : 1.5}px ${dashed ? "dashed" : "solid"} ${selected ? "#1a73e8" : color}`,
      background: isGcp ? "rgba(240,244,255,0.5)" : "rgba(248,249,251,0.3)",
      position: "relative",
      boxShadow: selected ? "0 0 0 3px rgba(26,115,232,0.2)" : "none",
    }}>
      {/* Resize handles — visible on select/hover */}
      <NodeResizer
        color={color}
        isVisible={selected || false}
        minWidth={150}
        minHeight={100}
        handleStyle={{ width: 10, height: 10, borderRadius: 2 }}
        lineStyle={{ borderWidth: 2 }}
      />
      {isGcp ? (
        <div style={{
          position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)",
          background: "#4285f4", color: "#fff", padding: "4px 16px", borderRadius: 8,
          fontSize: 12, fontWeight: 800, letterSpacing: 0.5, whiteSpace: "nowrap",
        }}>Google Cloud</div>
      ) : (
        <div style={{
          position: "absolute", top: -10, left: 10,
          background: "#fff", border: `1px solid ${color}`, padding: "2px 8px", borderRadius: 5,
          fontSize: 8.5, fontWeight: 700, color, letterSpacing: 0.8, whiteSpace: "nowrap",
        }}>{label}</div>
      )}
    </div>
  );
}

/* ── Build orthogonal path with rounded corners and a controllable middle segment ── */
/* For bent edges (different Y for horizontal, different X for vertical):
     mid = position of the middle bend segment along the flow axis
   For straight edges (same Y for horizontal, same X for vertical):
     mid = perpendicular offset to create a "bump" detour */
function buildOrthogonalPath(
  sx: number, sy: number, tx: number, ty: number,
  mid: number, isHorizontal: boolean, isStraight: boolean, r: number = 10
): string {
  if (isHorizontal) {
    const dy = ty - sy;
    if (isStraight) {
      // Straight horizontal — mid is perpendicular Y offset (bump detour)
      if (Math.abs(mid - sy) < 2) return `M ${sx} ${sy} L ${tx} ${ty}`;
      const bendX1 = sx + (tx - sx) * 0.25;
      const bendX2 = sx + (tx - sx) * 0.75;
      const cr = Math.max(0, Math.min(r, Math.abs(mid - sy) / 2, Math.abs(bendX1 - sx), Math.abs(tx - bendX2)));
      const signY = mid >= sy ? 1 : -1;
      const signX = tx >= sx ? 1 : -1;
      return [
        `M ${sx} ${sy}`,
        `L ${bendX1 - signX * cr} ${sy}`,
        `Q ${bendX1} ${sy} ${bendX1} ${sy + signY * cr}`,
        `L ${bendX1} ${mid - signY * cr}`,
        `Q ${bendX1} ${mid} ${bendX1 + signX * cr} ${mid}`,
        `L ${bendX2 - signX * cr} ${mid}`,
        `Q ${bendX2} ${mid} ${bendX2} ${mid - signY * cr}`,
        `L ${bendX2} ${ty + signY * cr}`,
        `Q ${bendX2} ${ty} ${bendX2 + signX * cr} ${ty}`,
        `L ${tx} ${ty}`,
      ].join(" ");
    }
    // 3 segments: horizontal → vertical → horizontal
    if (Math.abs(dy) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
    const signY = dy >= 0 ? 1 : -1;
    const cr = Math.max(0, Math.min(r, Math.abs(dy) / 2, Math.abs(mid - sx), Math.abs(tx - mid)));
    const signMidFromSrc = mid >= sx ? 1 : -1;
    const signMidFromTgt = tx >= mid ? 1 : -1;
    return [
      `M ${sx} ${sy}`,
      `L ${mid - signMidFromSrc * cr} ${sy}`,
      `Q ${mid} ${sy} ${mid} ${sy + signY * cr}`,
      `L ${mid} ${ty - signY * cr}`,
      `Q ${mid} ${ty} ${mid + signMidFromTgt * cr} ${ty}`,
      `L ${tx} ${ty}`,
    ].join(" ");
  } else {
    const dx = tx - sx;
    if (isStraight) {
      // Straight vertical — mid is perpendicular X offset (bump detour)
      if (Math.abs(mid - sx) < 2) return `M ${sx} ${sy} L ${tx} ${ty}`;
      const bendY1 = sy + (ty - sy) * 0.25;
      const bendY2 = sy + (ty - sy) * 0.75;
      const cr = Math.max(0, Math.min(r, Math.abs(mid - sx) / 2, Math.abs(bendY1 - sy), Math.abs(ty - bendY2)));
      const signX = mid >= sx ? 1 : -1;
      const signY = ty >= sy ? 1 : -1;
      return [
        `M ${sx} ${sy}`,
        `L ${sx} ${bendY1 - signY * cr}`,
        `Q ${sx} ${bendY1} ${sx + signX * cr} ${bendY1}`,
        `L ${mid - signX * cr} ${bendY1}`,
        `Q ${mid} ${bendY1} ${mid} ${bendY1 + signY * cr}`,
        `L ${mid} ${bendY2 - signY * cr}`,
        `Q ${mid} ${bendY2} ${mid - signX * cr} ${bendY2}`,
        `L ${tx + signX * cr} ${bendY2}`,
        `Q ${tx} ${bendY2} ${tx} ${bendY2 + signY * cr}`,
        `L ${tx} ${ty}`,
      ].join(" ");
    }
    // 3 segments: vertical → horizontal → vertical
    if (Math.abs(dx) < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
    const signX = dx >= 0 ? 1 : -1;
    const cr = Math.max(0, Math.min(r, Math.abs(dx) / 2, Math.abs(mid - sy), Math.abs(ty - mid)));
    const signMidFromSrc = mid >= sy ? 1 : -1;
    const signMidFromTgt = ty >= mid ? 1 : -1;
    return [
      `M ${sx} ${sy}`,
      `L ${sx} ${mid - signMidFromSrc * cr}`,
      `Q ${sx} ${mid} ${sx + signX * cr} ${mid}`,
      `L ${tx - signX * cr} ${mid}`,
      `Q ${tx} ${mid} ${tx} ${mid + signMidFromTgt * cr}`,
      `L ${tx} ${ty}`,
    ].join(" ");
  }
}

/* ── Custom edge with label + draggable middle segment ── */
function ArchEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, data, markerEnd, selected }: EdgeProps) {
  const { label, edgeType, isPrivate, step, pathOffset, edgeStyle, onOffsetChange } = (data || {}) as any;
  const { screenToFlowPosition } = useReactFlow();
  const typeColors: Record<string, string> = { data: "#1a73e8", control: "#7986cb", observe: "#78909c", alert: "#e53935" };
  const defaultCol = isPrivate ? "#43a047" : (typeColors[edgeType] || typeColors.data);
  const col = edgeStyle?.color || defaultCol;
  const strokeW = edgeStyle?.width || 2.5;
  const dashStyle = edgeStyle?.dash || (edgeType === "observe" ? "dashed" : edgeType === "control" ? "dashed" : "solid");
  const dashArray = dashStyle === "dashed" ? "6 4" : dashStyle === "dotted" ? "2 3" : "none";
  const [hovered, setHovered] = React.useState(false);

  // Determine if flow is primarily horizontal or vertical
  const isHorizontal = sourcePosition === Position.Right || sourcePosition === Position.Left;

  // Detect straight lines: same Y (horizontal) or same X (vertical)
  const isStraight = isHorizontal
    ? Math.abs(targetY - sourceY) < 2
    : Math.abs(targetX - sourceX) < 2;

  // Mid position:
  //   bent edges: position of the middle bend along the flow axis
  //   straight edges: perpendicular offset (Y for horizontal, X for vertical)
  const defaultMid = isStraight
    ? (isHorizontal ? sourceY : sourceX)  // default = on the line (no detour)
    : (isHorizontal ? (sourceX + targetX) / 2 : (sourceY + targetY) / 2);
  const mid = pathOffset ?? defaultMid;

  // Build orthogonal path
  const path = buildOrthogonalPath(sourceX, sourceY, targetX, targetY, mid, isHorizontal, isStraight);

  // Label position at center of middle segment
  const mx = isHorizontal ? (isStraight ? (sourceX + targetX) / 2 : mid) : (sourceX + targetX) / 2;
  const my = isHorizontal ? (isStraight ? mid : (sourceY + targetY) / 2) : (isStraight ? (sourceY + targetY) / 2 : mid);

  // Drag the middle segment to reshape
  const onSegmentPointerDown = React.useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const pos = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      // Straight edges: drag perpendicular; bent edges: drag along flow axis
      const newMid = isStraight
        ? (isHorizontal ? pos.y : pos.x)  // perpendicular
        : (isHorizontal ? pos.x : pos.y); // along flow
      if (onOffsetChange) onOffsetChange(id, newMid);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [id, isHorizontal, isStraight, screenToFlowPosition, onOffsetChange]);

  // Double-click middle segment to reset to default
  const onSegmentDoubleClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOffsetChange) onOffsetChange(id, undefined);
  }, [id, onOffsetChange]);

  // Drag zone coordinates — always at least 40px so it's grabbable
  const dragMinLen = 20;
  let dragX1: number, dragY1: number, dragX2: number, dragY2: number, dragCursor: string;
  if (isStraight) {
    // Straight line: drag zone sits along the line, cursor is perpendicular
    if (isHorizontal) {
      const midX = (sourceX + targetX) / 2;
      const halfLen = Math.max(Math.abs(targetX - sourceX) / 2, dragMinLen);
      dragX1 = midX - halfLen; dragY1 = mid;
      dragX2 = midX + halfLen; dragY2 = mid;
      dragCursor = "ns-resize";
    } else {
      const midY = (sourceY + targetY) / 2;
      const halfLen = Math.max(Math.abs(targetY - sourceY) / 2, dragMinLen);
      dragX1 = mid; dragY1 = midY - halfLen;
      dragX2 = mid; dragY2 = midY + halfLen;
      dragCursor = "ew-resize";
    }
  } else {
    // Bent line: drag zone on the middle bend segment
    if (isHorizontal) {
      const midY = (sourceY + targetY) / 2;
      const halfLen = Math.max(Math.abs(targetY - sourceY) / 2, dragMinLen);
      dragX1 = mid; dragY1 = midY - halfLen;
      dragX2 = mid; dragY2 = midY + halfLen;
      dragCursor = "ew-resize";
    } else {
      const midX = (sourceX + targetX) / 2;
      const halfLen = Math.max(Math.abs(targetX - sourceX) / 2, dragMinLen);
      dragX1 = midX - halfLen; dragY1 = mid;
      dragX2 = midX + halfLen; dragY2 = mid;
      dragCursor = "ns-resize";
    }
  }

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Invisible wider path for easier click/hover — rgba(0,0,0,0.001) counts as "visible" for RF's visibleStroke */}
      <path d={path} fill="none" stroke="rgba(0,0,0,0.001)" strokeWidth={20} style={{ cursor: "pointer", pointerEvents: "stroke" }} />
      {/* Visible path */}
      <path
        d={path}
        fill="none"
        stroke={selected ? "#1a73e8" : hovered ? "#ff6d00" : col}
        strokeWidth={selected ? strokeW + 1.5 : hovered ? strokeW + 1 : strokeW}
        strokeDasharray={dashArray}
        markerEnd={markerEnd}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke-width 0.15s, stroke 0.15s" }}
      />

      {/* Drag zone — rgba(0,0,0,0.001) is nearly invisible but satisfies RF's visibleStroke */}
      <line
        x1={dragX1} y1={dragY1} x2={dragX2} y2={dragY2}
        stroke="rgba(0,0,0,0.001)" strokeWidth={16}
        style={{ cursor: dragCursor, pointerEvents: "stroke" }}
        onPointerDown={onSegmentPointerDown}
        onDoubleClick={onSegmentDoubleClick}
      />

      {/* Edge label */}
      {(label || step > 0) && (
        <g>
          <rect
            x={mx - ((label || "").length * 3.5 + (step > 0 ? 20 : 6))}
            y={my - 10}
            width={(label || "").length * 7 + (step > 0 ? 24 : 12)}
            height={18}
            rx={5}
            fill={selected ? "#e3f2fd" : "#fff"}
            stroke={selected ? "#1a73e8" : col}
            strokeWidth={selected ? 1.2 : 0.8}
            fillOpacity={0.95}
            style={{ cursor: "pointer" }}
          />
          <text x={mx} y={my + 3} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600, fill: selected ? "#1a73e8" : col }}>
            {step > 0 ? `(${step}) ` : ""}{label || ""}
          </text>
        </g>
      )}
    </g>
  );
}

const nodeTypes = { arch: ArchNode, zone: ZoneNode };
const edgeTypes = { arch: ArchEdge };

/* ── Main Component ── */
interface ReactFlowCanvasProps {
  diag: Diagram;
  setDiag: (d: Diagram) => void;
  theme?: string;
  onDragEnd?: (d: Diagram) => void;
  onNodeDoubleClick?: (nodeId: string, event: React.MouseEvent) => void;
  onEdgeDoubleClick?: (edgeId: string, event: React.MouseEvent) => void;
}

export default function ReactFlowCanvas({ diag, setDiag, theme = "light", onDragEnd, onNodeDoubleClick, onEdgeDoubleClick }: ReactFlowCanvasProps) {
  const diagRef = useRef(diag);
  diagRef.current = diag;
  const isDark = theme === "blueprint" || theme === "dark";

  // Flag to skip sync when change originated from internal drag/edit
  const internalUpdate = useRef(false);

  // Cache zone bounds so they don't shift when nodes are dragged
  const zoneBoundsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }> | null>(null);
  // Track node IDs to detect external diagram changes (code apply) vs drag changes
  const prevNodeIdsRef = useRef<string>("");
  const nodeIdsSig = diag.nodes.map(n => n.id).sort().join(",");
  if (nodeIdsSig !== prevNodeIdsRef.current) {
    zoneBoundsRef.current = null; // Reset zone cache when nodes change (external update)
    prevNodeIdsRef.current = nodeIdsSig;
  }

  // Load icons on mount
  useEffect(() => { loadIcons(); }, []);

  // Convert our Diagram model to React Flow nodes
  const rfNodes = useMemo(() => {
    const nodes: Node[] = [];

    // Build zone lookup: zoneId -> { rfId, x, y }
    const zoneMap = new Map<string, { rfId: string; x: number; y: number }>();

    // Zone group nodes (rendered as background groups)
    const backendZones = (diag as any).zones as any[] || [];
    const hasBackendZones = backendZones.length > 0 && backendZones[0]?.x !== undefined;

    if (hasBackendZones) {
      backendZones.forEach((z: any) => {
        if (z.x === undefined || z.w === undefined) return;
        const rfId = `zone-${z.id}`;
        zoneMap.set(z.id, { rfId, x: z.x, y: z.y });
        nodes.push({
          id: rfId,
          type: "zone",
          position: { x: z.x, y: z.y },
          data: {
            label: z.label,
            color: z.color,
            dashed: z.dashed,
            isGcp: z.id === "gcp",
            width: z.w,
            height: z.h,
          },
          draggable: true,
          selectable: true,
          style: { width: z.w, height: z.h, zIndex: -1 },
        });
      });
    } else {
      // Auto-compute zone bounds from node positions — only on first render, then cache
      const byZone = (z: string) => diag.nodes.filter(n => n.zone === z);
      const zBounds = (ns: DiagNode[], px: number, py: number, minW = 0) => {
        if (!ns.length) return null;
        const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
        return { x: Math.min(...xs) - px, y: Math.min(...ys) - py, w: Math.max(Math.max(...xs) - Math.min(...xs) + px * 2 + 90, minW), h: Math.max(...ys) - Math.min(...ys) + py * 2 + 100 };
      };

      // Compute fresh bounds only if we don't have cached ones
      if (!zoneBoundsRef.current) {
        const computed = new Map<string, { x: number; y: number; w: number; h: number }>();
        const zoneConfigs = [
          { id: "sources", zone: "sources", label: "SOURCES", color: "#bdbdbd", dashed: true },
          { id: "cloud", zone: "cloud", label: "Google Cloud", color: "#4285f4", dashed: false },
          { id: "consumers", zone: "consumers", label: "CONSUMERS", color: "#bdbdbd", dashed: true },
          { id: "external", zone: "external", label: "EXTERNAL", color: "#BF360C", dashed: true },
        ];
        zoneConfigs.forEach(zc => {
          const b = zBounds(byZone(zc.zone), 80, 70, 200);
          if (b) computed.set(zc.id, b);
        });
        zoneBoundsRef.current = computed;
      }

      const cachedBounds = zoneBoundsRef.current;
      const zoneConfigs = [
        { id: "sources", zone: "sources", label: "SOURCES", color: "#bdbdbd", dashed: true },
        { id: "cloud", zone: "cloud", label: "Google Cloud", color: "#4285f4", dashed: false },
        { id: "consumers", zone: "consumers", label: "CONSUMERS", color: "#bdbdbd", dashed: true },
        { id: "external", zone: "external", label: "EXTERNAL", color: "#BF360C", dashed: true },
      ];
      zoneConfigs.forEach(zc => {
        const b = cachedBounds.get(zc.id);
        if (!b) return;
        const rfId = `zone-${zc.id}`;
        zoneMap.set(zc.zone, { rfId, x: b.x, y: b.y });
        nodes.push({
          id: rfId,
          type: "zone",
          position: { x: b.x, y: b.y },
          data: { label: zc.label, color: zc.color, dashed: zc.dashed, isGcp: zc.id === "cloud", width: b.w, height: b.h },
          draggable: true,
          selectable: true,
          style: { width: b.w, height: b.h, zIndex: -1 },
        });
      });
    }

    // Diagram nodes — placed as children of their zone (relative position)
    diag.nodes.forEach(n => {
      const ip = n.icon ? iconUrl(n.name, n.icon) : null;
      const cat = getCat(n.icon, n.id);
      const threats = (diag.threats || []).filter(t => t.target === n.id);

      // Find parent zone
      const zoneKey = hasBackendZones ? n.subZone : n.zone;
      let parentZone = zoneKey ? zoneMap.get(zoneKey) : undefined;
      // Fallback: try the main zone
      if (!parentZone) parentZone = zoneMap.get(n.zone);

      const absX = n.x - 55;
      const absY = n.y - 55;

      const nodeEntry: Node = {
        id: n.id,
        type: "arch",
        position: parentZone
          ? { x: absX - parentZone.x, y: absY - parentZone.y }
          : { x: absX, y: absY },
        data: {
          label: n.name,
          subtitle: n.subtitle,
          iconSrc: ip,
          cat,
          threats,
          zone: n.zone,
          nodeId: n.id,
          nodeStyle: n.style,
        },
        draggable: true,
      };
      if (parentZone) {
        (nodeEntry as any).parentId = parentZone.rfId;
      }

      nodes.push(nodeEntry);
    });

    return nodes;
  }, [diag]);

  // Handle edge path offset changes from middle segment drag
  const handleOffsetChange = useCallback((edgeId: string, newOffset: number | undefined) => {
    const cur = diagRef.current;
    const updated = {
      ...cur,
      edges: cur.edges.map(e => e.id === edgeId ? { ...e, pathOffset: newOffset } : e),
    };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd]);

  // Convert our edges to React Flow edges
  const rfEdges = useMemo(() => {
    return diag.edges.map(e => {
      const isPrivate = e.security?.private;
      const typeColors: Record<string, string> = { data: "#1a73e8", control: "#7986cb", observe: "#78909c", alert: "#e53935" };
      const defaultCol = isPrivate ? "#43a047" : (typeColors[e.edgeType || "data"] || typeColors.data);
      const col = e.style?.color || defaultCol;
      const arrowHead = e.style?.arrowHead || "arrow";
      const markerType = arrowHead === "arrowclosed" ? MarkerType.ArrowClosed : MarkerType.Arrow;

      // Auto-pick handles based on node positions if not explicitly set
      let srcHandle = e.sourceHandle || null;
      let tgtHandle = e.targetHandle || null;
      if (!srcHandle || !tgtHandle) {
        const srcNode = diag.nodes.find(n => n.id === e.from);
        const tgtNode = diag.nodes.find(n => n.id === e.to);
        if (srcNode && tgtNode) {
          const auto = bestHandles(srcNode.x, srcNode.y, tgtNode.x, tgtNode.y);
          if (!srcHandle) srcHandle = auto.sourceHandle;
          if (!tgtHandle) tgtHandle = auto.targetHandle;
        }
      }

      return {
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: srcHandle,
        targetHandle: tgtHandle,
        type: "arch",
        data: {
          label: e.label,
          edgeType: e.edgeType || "data",
          isPrivate,
          step: e.step,
          pathOffset: e.pathOffset,
          edgeStyle: e.style,
          onOffsetChange: handleOffsetChange,
        },
        markerEnd: arrowHead === "none" ? undefined : { type: markerType, color: col, width: 20, height: 16, strokeWidth: 2 },
        style: { stroke: col },
      } as Edge;
    });
  }, [diag.edges, diag.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Sync React Flow state when diagram changes externally (skip if we caused the change)
  useEffect(() => {
    if (internalUpdate.current) { internalUpdate.current = false; return; }
    setNodes(rfNodes);
  }, [rfNodes]);
  useEffect(() => {
    if (internalUpdate.current) { internalUpdate.current = false; return; }
    setEdges(rfEdges);
  }, [rfEdges]);

  // Helper: get absolute position of a React Flow node (accounts for parent offset)
  const getAbsolutePos = useCallback((node: Node, allNodes: Node[]) => {
    let x = node.position.x;
    let y = node.position.y;
    const parentId = (node as any).parentId;
    if (parentId) {
      const parent = allNodes.find(n => n.id === parentId);
      if (parent) { x += parent.position.x; y += parent.position.y; }
    }
    return { x, y };
  }, []);

  // Handle node drag stop — update our diagram model
  const onNodeDragStop = useCallback((_: any, node: Node, allNodes: Node[]) => {
    const cur = diagRef.current;

    // Zone drag: children move automatically in React Flow,
    // but we need to update all child node absolute positions in our model
    if (node.id.startsWith("zone-")) {
      const childRfNodes = allNodes.filter((n: any) => n.parentId === node.id && !n.id.startsWith("zone-"));
      if (!childRfNodes.length) return;
      const updated = {
        ...cur,
        nodes: cur.nodes.map(n => {
          const rfChild = childRfNodes.find(c => c.id === n.id);
          if (!rfChild) return n;
          const abs = getAbsolutePos(rfChild, allNodes);
          return { ...n, x: Math.round(abs.x + 55), y: Math.round(abs.y + 55) };
        }),
      };
      internalUpdate.current = true;
      setDiag(updated);
      if (onDragEnd) onDragEnd(updated);
      return;
    }

    // Single node drag
    const abs = getAbsolutePos(node, allNodes);
    const updated = {
      ...cur,
      nodes: cur.nodes.map(n =>
        n.id === node.id
          ? { ...n, x: Math.round(abs.x + 55), y: Math.round(abs.y + 55) }
          : n
      ),
    };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd, getAbsolutePos]);

  // Handle multiple nodes drag stop
  const onSelectionDragStop = useCallback((_: any, selectedNodes: Node[]) => {
    // Get the latest nodes from the state to compute absolute positions
    const cur = diagRef.current;
    setNodes(currentNodes => {
      const updates = new Map<string, { x: number; y: number }>();
      selectedNodes.forEach(sn => {
        if (sn.id.startsWith("zone-")) return;
        const abs = getAbsolutePos(sn, currentNodes);
        updates.set(sn.id, abs);
      });
      if (!updates.size) return currentNodes;
      const updated = {
        ...cur,
        nodes: cur.nodes.map(n => {
          const pos = updates.get(n.id);
          return pos ? { ...n, x: Math.round(pos.x + 55), y: Math.round(pos.y + 55) } : n;
        }),
      };
      internalUpdate.current = true;
      setDiag(updated);
      if (onDragEnd) onDragEnd(updated);
      return currentNodes;
    });
  }, [setDiag, onDragEnd, getAbsolutePos, setNodes]);

  // Handle new edge connections
  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const cur = diagRef.current;
    const newEdge: DiagEdge = {
      id: `e-${conn.source}-${conn.target}-${Date.now()}`,
      from: conn.source,
      to: conn.target,
      label: "",
      step: 0,
      edgeType: "data",
      sourceHandle: conn.sourceHandle || undefined,
      targetHandle: conn.targetHandle || undefined,
    };
    const updated = { ...cur, edges: [...cur.edges, newEdge] };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd]);

  // Handle node delete
  const onNodesDelete = useCallback((deleted: Node[]) => {
    const ids = new Set(deleted.map(n => n.id));
    const cur = diagRef.current;
    const updated = {
      ...cur,
      nodes: cur.nodes.filter(n => !ids.has(n.id)),
      edges: cur.edges.filter(e => !ids.has(e.from) && !ids.has(e.to)),
    };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd]);

  // Handle edge delete
  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    const ids = new Set(deleted.map(e => e.id));
    const cur = diagRef.current;
    const updated = { ...cur, edges: cur.edges.filter(e => !ids.has(e.id)) };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd]);

  // Double-click handlers
  const handleNodeDblClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("zone-")) return;
    if (onNodeDoubleClick) onNodeDoubleClick(node.id, _);
  }, [onNodeDoubleClick]);

  const handleEdgeDblClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (onEdgeDoubleClick) onEdgeDoubleClick(edge.id, _);
  }, [onEdgeDoubleClick]);

  // Add a new zone group
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneLabel, setNewZoneLabel] = useState("");
  const [newZoneColor, setNewZoneColor] = useState("#7986cb");

  const addZone = useCallback(() => {
    if (!newZoneLabel.trim()) return;
    const zoneId = `custom-${Date.now()}`;
    const rfId = `zone-${zoneId}`;
    const newNode: Node = {
      id: rfId,
      type: "zone",
      position: { x: 100, y: 100 },
      data: {
        label: newZoneLabel.trim().toUpperCase(),
        color: newZoneColor,
        dashed: true,
        isGcp: false,
        width: 300,
        height: 200,
      },
      draggable: true,
      selectable: true,
      style: { width: 300, height: 200, zIndex: -1 },
    };
    // Add to cached bounds
    if (zoneBoundsRef.current) {
      zoneBoundsRef.current.set(zoneId, { x: 100, y: 100, w: 300, h: 200 });
    }
    setNodes(prev => [...prev, newNode]);
    setShowAddZone(false);
    setNewZoneLabel("");
  }, [newZoneLabel, newZoneColor, setNodes]);

  // ── Selection-based style toolbar ──
  const [selectedEl, setSelectedEl] = useState<{ type: "node" | "edge"; id: string } | null>(null);

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: { nodes: Node[]; edges: Edge[] }) => {
    const realNodes = selNodes.filter(n => !n.id.startsWith("zone-"));
    if (realNodes.length === 1 && selEdges.length === 0) {
      setSelectedEl({ type: "node", id: realNodes[0].id });
    } else if (selEdges.length === 1 && realNodes.length === 0) {
      setSelectedEl({ type: "edge", id: selEdges[0].id });
    } else {
      setSelectedEl(null);
    }
  }, []);

  const updateNodeStyle = useCallback((nodeId: string, patch: Partial<NodeStyle>) => {
    const cur = diagRef.current;
    const updated = {
      ...cur,
      nodes: cur.nodes.map(n => n.id === nodeId ? { ...n, style: { ...n.style, ...patch } } : n),
    };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd]);

  const updateEdgeStyle = useCallback((edgeId: string, patch: Partial<EdgeStyle>) => {
    const cur = diagRef.current;
    const updated = {
      ...cur,
      edges: cur.edges.map(e => e.id === edgeId ? { ...e, style: { ...e.style, ...patch } } : e),
    };
    internalUpdate.current = true;
    setDiag(updated);
    if (onDragEnd) onDragEnd(updated);
  }, [setDiag, onDragEnd]);

  const bgVariant = theme === "dotgrid" || theme === "blueprint" || theme === "dark"
    ? BackgroundVariant.Dots : BackgroundVariant.Dots;
  const bgColor = isDark ? "#1e1e1e" : "#f8f9fa";
  const bgGap = 20;

  const SWATCH = ["#1a73e8", "#43a047", "#e53935", "#fb8c00", "#8e24aa", "#00897b", "#f06292", "#78909c", "#546e7a", "#333333"];

  return (
    <div style={{ flex: 1, position: "relative" }}>
      {/* Title overlay */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10,
        textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: isDark ? "#e0e0e0" : "#111", letterSpacing: -0.3 }}>{diag.title}</div>
        {diag.subtitle && <div style={{ fontSize: 11, color: isDark ? "#78909c" : "#999", fontStyle: "italic", marginTop: 2 }}>{diag.subtitle}</div>}
      </div>

      {/* Add Zone button */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 6, alignItems: "flex-start" }}>
        {!showAddZone ? (
          <button
            onClick={() => setShowAddZone(true)}
            style={{
              background: "#fff", border: "1px solid #ccc", borderRadius: 8, padding: "6px 14px",
              fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Zone
          </button>
        ) : (
          <div style={{
            background: "#fff", border: "1px solid #ccc", borderRadius: 10, padding: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: 220,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>New Zone Group</div>
            <input
              type="text"
              placeholder="Zone name..."
              value={newZoneLabel}
              onChange={e => setNewZoneLabel(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addZone(); if (e.key === "Escape") setShowAddZone(false); }}
              autoFocus
              style={{
                width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6,
                fontSize: 12, marginBottom: 8, boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {["#7986cb", "#4285f4", "#43a047", "#fb8c00", "#e53935", "#8e24aa", "#78909c", "#bdbdbd"].map(c => (
                <div
                  key={c}
                  onClick={() => setNewZoneColor(c)}
                  style={{
                    width: 22, height: 22, borderRadius: 4, background: c, cursor: "pointer",
                    border: newZoneColor === c ? "3px solid #111" : "2px solid transparent",
                    transition: "border 0.1s",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={addZone}
                style={{
                  flex: 1, padding: "6px 0", background: "#1a73e8", color: "#fff", border: "none",
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >Add</button>
              <button
                onClick={() => { setShowAddZone(false); setNewZoneLabel(""); }}
                style={{
                  flex: 1, padding: "6px 0", background: "#f5f5f5", color: "#555", border: "1px solid #ddd",
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >Cancel</button>
            </div>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onSelectionDragStop={onSelectionDragStop}
        onConnect={onConnect}

        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDoubleClick={handleNodeDblClick}
        onEdgeDoubleClick={handleEdgeDblClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={true}
        snapGrid={[15, 15]}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode="Shift"
        selectionOnDrag
        panOnDrag={[1, 2]} // left + middle mouse
        selectionMode={"partial" as any}
        edgesFocusable={true}
        connectionMode={"loose" as any}
        connectionRadius={40}
        defaultEdgeOptions={{
          type: "arch",
          animated: false,
          selectable: true,
          focusable: true,
        }}
        style={{ background: bgColor }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={bgVariant} gap={bgGap} color={isDark ? "#333" : "#e0e0e0"} size={1} />
        <Controls
          position="bottom-left"
          showInteractive={false}
          style={{ borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
        />
      </ReactFlow>

      {/* ── Style Toolbar (appears on selection) ── */}
      {selectedEl && (() => {
        const isEdge = selectedEl.type === "edge";
        const edge = isEdge ? diagRef.current.edges.find(e => e.id === selectedEl.id) : null;
        const node = !isEdge ? diagRef.current.nodes.find(n => n.id === selectedEl.id) : null;
        if (isEdge && !edge) return null;
        if (!isEdge && !node) return null;

        const barStyle: React.CSSProperties = {
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20,
          background: "#fff", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          border: "1px solid #e0e0e0", padding: "8px 14px",
          display: "flex", alignItems: "center", gap: 16,
          fontFamily: "'Inter',system-ui,sans-serif",
        };
        const secStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5 };
        const secLabel: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: "#aaa", letterSpacing: 0.5, marginRight: 2 };
        const swatch = (c: string, active: boolean, onClick: () => void): React.CSSProperties => ({
          width: 18, height: 18, borderRadius: 4, background: c, cursor: "pointer",
          border: active ? "2.5px solid #111" : "1.5px solid #ccc", transition: "border 0.1s",
          display: "inline-block",
        });
        const pill = (active: boolean): React.CSSProperties => ({
          padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
          background: active ? "#e3f2fd" : "#f5f5f5",
          border: active ? "1px solid #1a73e8" : "1px solid #ddd",
          color: active ? "#1a73e8" : "#555",
        });
        const divider: React.CSSProperties = { width: 1, height: 24, background: "#e0e0e0" };

        if (isEdge && edge) {
          const s = edge.style || {};
          return (
            <div style={barStyle}>
              {/* Color */}
              <div style={secStyle}>
                <span style={secLabel}>COLOR</span>
                {SWATCH.slice(0, 6).map(c => (
                  <div key={c} style={swatch(c, s.color === c, () => updateEdgeStyle(edge.id, { color: c }))} onClick={() => updateEdgeStyle(edge.id, { color: c })} />
                ))}
                <div style={swatch("transparent", !s.color, () => updateEdgeStyle(edge.id, { color: undefined }))} onClick={() => updateEdgeStyle(edge.id, { color: undefined })}>
                  <span style={{ fontSize: 7, color: "#999", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>auto</span>
                </div>
              </div>
              <div style={divider} />
              {/* Thickness */}
              <div style={secStyle}>
                <span style={secLabel}>WIDTH</span>
                {[{ label: "1", w: 1.5 }, { label: "2", w: 2.5 }, { label: "3", w: 4 }].map(o => (
                  <button key={o.label} onClick={() => updateEdgeStyle(edge.id, { width: o.w })} style={pill((s.width || 2.5) === o.w)}>{o.label}</button>
                ))}
              </div>
              <div style={divider} />
              {/* Dash */}
              <div style={secStyle}>
                <span style={secLabel}>LINE</span>
                {(["solid", "dashed", "dotted"] as const).map(d => (
                  <button key={d} onClick={() => updateEdgeStyle(edge.id, { dash: d })} style={{ ...pill((s.dash || "solid") === d), textTransform: "capitalize" as const }}>{d === "solid" ? "━" : d === "dashed" ? "╌" : "┈"}</button>
                ))}
              </div>
              <div style={divider} />
              {/* Arrow */}
              <div style={secStyle}>
                <span style={secLabel}>ARROW</span>
                {([{ id: "arrow" as const, label: "▷" }, { id: "arrowclosed" as const, label: "▶" }, { id: "none" as const, label: "—" }]).map(a => (
                  <button key={a.id} onClick={() => updateEdgeStyle(edge.id, { arrowHead: a.id })} style={pill((s.arrowHead || "arrow") === a.id)}>{a.label}</button>
                ))}
              </div>
            </div>
          );
        }

        if (!isEdge && node) {
          const s = node.style || {};
          return (
            <div style={barStyle}>
              {/* Background */}
              <div style={secStyle}>
                <span style={secLabel}>BG</span>
                {["#e3f2fd", "#e8f5e9", "#fff3e0", "#fce4ec", "#f3e5f5", "#e0f7fa", "#eceff1", "#fff"].map(c => (
                  <div key={c} style={swatch(c, s.bgColor === c, () => updateNodeStyle(node.id, { bgColor: c }))} onClick={() => updateNodeStyle(node.id, { bgColor: c })} />
                ))}
                <div style={swatch("transparent", !s.bgColor, () => updateNodeStyle(node.id, { bgColor: undefined }))} onClick={() => updateNodeStyle(node.id, { bgColor: undefined })}>
                  <span style={{ fontSize: 7, color: "#999", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>auto</span>
                </div>
              </div>
              <div style={divider} />
              {/* Border */}
              <div style={secStyle}>
                <span style={secLabel}>BORDER</span>
                {SWATCH.slice(0, 6).map(c => (
                  <div key={c} style={swatch(c, s.borderColor === c, () => updateNodeStyle(node.id, { borderColor: c }))} onClick={() => updateNodeStyle(node.id, { borderColor: c })} />
                ))}
                <div style={swatch("transparent", !s.borderColor, () => updateNodeStyle(node.id, { borderColor: undefined }))} onClick={() => updateNodeStyle(node.id, { borderColor: undefined })}>
                  <span style={{ fontSize: 7, color: "#999", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>auto</span>
                </div>
              </div>
              <div style={divider} />
              {/* Label color */}
              <div style={secStyle}>
                <span style={secLabel}>TEXT</span>
                {["#222", "#1a73e8", "#e53935", "#43a047", "#8e24aa", "#fff"].map(c => (
                  <div key={c} style={swatch(c, s.labelColor === c, () => updateNodeStyle(node.id, { labelColor: c }))} onClick={() => updateNodeStyle(node.id, { labelColor: c })} />
                ))}
                <div style={swatch("transparent", !s.labelColor, () => updateNodeStyle(node.id, { labelColor: undefined }))} onClick={() => updateNodeStyle(node.id, { labelColor: undefined })}>
                  <span style={{ fontSize: 7, color: "#999", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>auto</span>
                </div>
              </div>
              <div style={divider} />
              {/* Label size */}
              <div style={secStyle}>
                <span style={secLabel}>SIZE</span>
                {[{ label: "S", sz: 10 }, { label: "M", sz: 12 }, { label: "L", sz: 14 }, { label: "XL", sz: 16 }].map(o => (
                  <button key={o.label} onClick={() => updateNodeStyle(node.id, { labelSize: o.sz })} style={pill((s.labelSize || 12) === o.sz)}>{o.label}</button>
                ))}
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}
