import React, { useCallback, useEffect, useRef } from "react";
import { Tldraw, useEditor, createShapeId, type Editor, type TLShapeId } from "tldraw";
import "tldraw/tldraw.css";

/* ── Types (same as dashboard) ── */
interface NodeDetails { project?: string; region?: string; serviceAccount?: string; iamRoles?: string; encryption?: string; monitoring?: string; retry?: string; alerting?: string; cost?: string; troubleshoot?: string; guardrails?: string; compliance?: string; notes?: string }
interface DiagNode { id: string; name: string; icon?: string | null; subtitle?: string; zone: "sources" | "cloud" | "consumers" | "connectivity" | "external"; subZone?: string; x: number; y: number; details?: NodeDetails }
interface EdgeSecurity { transport: string; auth: string; classification: string; private: boolean; network?: string; vpcsc?: string; dlp?: string; keyRotation?: string; egressPolicy?: string; compliance?: string }
interface DiagEdge { id: string; from: string; to: string; label?: string; subtitle?: string; step: number; security?: EdgeSecurity; crossesBoundary?: boolean; edgeType?: "data" | "control" | "observe" | "alert" }
interface Threat { id: string; target: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance?: string | null }
interface Phase { id: string; name: string; nodeIds: string[] }
interface OpsGroup { name: string; nodeIds: string[] }
interface Diagram { title: string; subtitle?: string; layout?: string; nodes: DiagNode[]; edges: DiagEdge[]; threats?: Threat[]; phases?: Phase[]; opsGroup?: OpsGroup }

/* ── Icon helpers ── */
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

/* ── Zone colors ── */
const ZONE_COLORS: Record<string, { color: string; label: string }> = {
  sources: { color: "#9e9e9e", label: "SOURCES" },
  cloud: { color: "#4285f4", label: "Google Cloud" },
  consumers: { color: "#9e9e9e", label: "CONSUMERS" },
  external: { color: "#BF360C", label: "EXTERNAL" },
  connectivity: { color: "#f9a825", label: "CONNECTIVITY" },
};

/* ── Node size ── */
const NODE_W = 140;
const NODE_H = 100;

/* ── Props ── */
interface TldrawCanvasProps {
  diag: Diagram;
  setDiag: (d: Diagram) => void;
  theme?: string;
  onDragEnd?: (d: Diagram) => void;
  onNodeDoubleClick?: (nodeId: string, event: React.MouseEvent) => void;
  onEdgeDoubleClick?: (edgeId: string, event: React.MouseEvent) => void;
}

/* ── Helper: convert plain text to tldraw v4 TLRichText format ── */
function toRichText(text: string) {
  return {
    type: "doc" as const,
    content: text.split("\n").map(line => ({
      type: "paragraph" as const,
      content: line ? [{ type: "text" as const, text: line }] : [],
    })),
  };
}

/* ── Helper: create a stable shape ID from our node/edge ID ── */
function nodeShapeId(nodeId: string): TLShapeId {
  return createShapeId(`n-${nodeId}`);
}
function edgeShapeId(edgeId: string): TLShapeId {
  return createShapeId(`e-${edgeId}`);
}
function zoneShapeId(zone: string): TLShapeId {
  return createShapeId(`z-${zone}`);
}

/* ── Inner component that has access to the editor ── */
function TldrawInner({ diag, setDiag, onDragEnd, onNodeDoubleClick, onEdgeDoubleClick }: TldrawCanvasProps) {
  const editor = useEditor();
  const diagRef = useRef(diag);
  diagRef.current = diag;
  const initializedRef = useRef(false);
  const syncingRef = useRef(false);

  // Populate tldraw with our diagram shapes
  const populateCanvas = useCallback(async (ed: Editor, d: Diagram) => {
    syncingRef.current = true;

    // Clear existing shapes
    const allShapes = ed.getCurrentPageShapeIds();
    if (allShapes.size > 0) {
      ed.deleteShapes(Array.from(allShapes));
    }

    await loadIcons();

    const shapes: any[] = [];

    // 1. Create zone frames
    const nodesByZone = new Map<string, DiagNode[]>();
    d.nodes.forEach(n => {
      const z = n.zone;
      if (!nodesByZone.has(z)) nodesByZone.set(z, []);
      nodesByZone.get(z)!.push(n);
    });

    nodesByZone.forEach((zNodes: DiagNode[], zone: string) => {
      const zc = ZONE_COLORS[zone] || { color: "#9e9e9e", label: zone.toUpperCase() };
      const xs = zNodes.map((n: DiagNode) => n.x);
      const ys = zNodes.map((n: DiagNode) => n.y);
      const pad = 80;
      const zx = Math.min(...xs) - pad;
      const zy = Math.min(...ys) - pad - 30;
      const zw = Math.max(Math.max(...xs) - Math.min(...xs) + NODE_W + pad * 2, 250);
      const zh = Math.max(...ys) - Math.min(...ys) + NODE_H + pad * 2 + 30;

      shapes.push({
        id: zoneShapeId(zone),
        type: "frame",
        x: zx,
        y: zy,
        props: {
          w: zw,
          h: zh,
          name: zc.label,
        },
      });
    });

    // 2. Create node shapes (as rectangles with text)
    d.nodes.forEach((n) => {
      const zone = n.zone;
      shapes.push({
        id: nodeShapeId(n.id),
        type: "geo",
        x: n.x - NODE_W / 2,
        y: n.y - NODE_H / 2,
        parentId: zoneShapeId(zone),
        props: {
          w: NODE_W,
          h: NODE_H,
          geo: "rectangle",
          color: "light-blue",
          fill: "semi",
          dash: "draw",
          size: "s",
          richText: toRichText(n.name + (n.subtitle ? `\n${n.subtitle}` : "")),
          font: "sans",
          align: "middle",
          verticalAlign: "end",
        },
      });

      // Add icon as image if available
      const iUrl = n.icon ? iconUrl(n.name, n.icon) : null;
      if (iUrl) {
        // tldraw image shapes need an asset — text label is sufficient for now
      }
    });

    // 3. Create edge shapes (as arrows)
    d.edges.forEach((e) => {
      const fromNode = d.nodes.find((nn: DiagNode) => nn.id === e.from);
      const toNode = d.nodes.find((nn: DiagNode) => nn.id === e.to);
      if (!fromNode || !toNode) return;

      shapes.push({
        id: edgeShapeId(e.id),
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          color: e.edgeType === "control" ? "violet" : e.edgeType === "observe" ? "grey" : e.edgeType === "alert" ? "red" : "blue",
          dash: e.edgeType === "observe" ? "dashed" : e.edgeType === "control" ? "dotted" : "draw",
          size: "s",
          fill: "none",
          arrowheadEnd: "arrow",
          arrowheadStart: "none",
          richText: toRichText(e.label ? `${e.step ? `(${e.step}) ` : ""}${e.label}` : (e.step ? `(${e.step})` : "")),
        },
      });
    });

    // Create all shapes at once
    ed.createShapes(shapes);

    // 4. Bind arrows to nodes
    d.edges.forEach((e) => {
      const fromNode = d.nodes.find((nn: DiagNode) => nn.id === e.from);
      const toNode = d.nodes.find((nn: DiagNode) => nn.id === e.to);
      if (!fromNode || !toNode) return;

      try {
        const arrowId = edgeShapeId(e.id);
        const startId = nodeShapeId(e.from);
        const endId = nodeShapeId(e.to);

        ed.createBindings([
          {
            id: `binding:${e.id}-start` as any,
            type: "arrow",
            fromId: arrowId,
            toId: startId,
            props: {
              terminal: "start",
              isExact: false,
              isPrecise: false,
              normalizedAnchor: { x: 0.5, y: 0.5 },
            },
          },
          {
            id: `binding:${e.id}-end` as any,
            type: "arrow",
            fromId: arrowId,
            toId: endId,
            props: {
              terminal: "end",
              isExact: false,
              isPrecise: false,
              normalizedAnchor: { x: 0.5, y: 0.5 },
            },
          },
        ]);
      } catch (err) {
        console.warn("Failed to bind arrow:", e.id, err);
      }
    });

    // Zoom to fit
    setTimeout(() => {
      ed.zoomToFit({ animation: { duration: 300 } });
    }, 100);

    syncingRef.current = false;
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (!editor || initializedRef.current) return;
    initializedRef.current = true;
    populateCanvas(editor, diag);
  }, [editor, diag, populateCanvas]);

  // Re-populate when diagram changes externally (e.g., code apply)
  const prevDiagJsonRef = useRef("");
  useEffect(() => {
    if (!editor || !initializedRef.current) return;
    const json = JSON.stringify({ nodes: diag.nodes.map(n => n.id).sort(), edges: diag.edges.map(e => e.id).sort() });
    if (json === prevDiagJsonRef.current) return;
    prevDiagJsonRef.current = json;
    if (syncingRef.current) return;
    populateCanvas(editor, diag);
  }, [editor, diag, populateCanvas]);

  // Sync tldraw changes back to our diagram model
  useEffect(() => {
    if (!editor) return;

    const handleChange = () => {
      if (syncingRef.current) return;

      const cur = diagRef.current;
      let changed = false;
      const updatedNodes = cur.nodes.map(n => {
        const shapeId = nodeShapeId(n.id);
        const shape = editor.getShape(shapeId);
        if (!shape) return n;
        // Get the shape's page-level position
        const pageBounds = editor.getShapePageBounds(shapeId);
        if (!pageBounds) return n;
        const newX = Math.round(pageBounds.x + pageBounds.w / 2);
        const newY = Math.round(pageBounds.y + pageBounds.h / 2);
        if (Math.abs(newX - n.x) > 2 || Math.abs(newY - n.y) > 2) {
          changed = true;
          return { ...n, x: newX, y: newY };
        }
        return n;
      });

      if (changed) {
        const updated = { ...cur, nodes: updatedNodes };
        syncingRef.current = true;
        setDiag(updated);
        if (onDragEnd) onDragEnd(updated);
        // Reset sync flag after React processes the update
        requestAnimationFrame(() => { syncingRef.current = false; });
      }
    };

    // Listen for pointer up (end of drag) to sync positions
    const onPointerUp = () => {
      // Small delay to let tldraw finalize positions
      setTimeout(handleChange, 50);
    };

    // Use the store's change listener for more reliable updates
    const cleanup = editor.store.listen(
      () => { /* batch */ },
      { source: "user", scope: "document" }
    );

    // Also listen for pointer events as a fallback
    const container = document.querySelector(".tl-container");
    if (container) {
      container.addEventListener("pointerup", onPointerUp);
    }

    return () => {
      cleanup();
      if (container) {
        container.removeEventListener("pointerup", onPointerUp);
      }
    };
  }, [editor, setDiag, onDragEnd]);

  return null;
}

/* ── Main component ── */
export default function TldrawCanvas({ diag, setDiag, theme = "light", onDragEnd, onNodeDoubleClick, onEdgeDoubleClick }: TldrawCanvasProps) {
  const isDark = theme === "blueprint" || theme === "dark";

  return (
    <div style={{ flex: 1, position: "relative", width: "100%", height: "100%" }}>
      {/* Title overlay */}
      <div style={{
        position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10,
        textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: isDark ? "#e0e0e0" : "#111", letterSpacing: -0.3 }}>
          {diag.title}
        </div>
        {diag.subtitle && (
          <div style={{ fontSize: 11, color: isDark ? "#78909c" : "#999", fontStyle: "italic", marginTop: 2 }}>
            {diag.subtitle}
          </div>
        )}
      </div>

      <Tldraw
        inferDarkMode={isDark}
        options={{
          maxPages: 1,
        }}
      >
        <TldrawInner
          diag={diag}
          setDiag={setDiag}
          theme={theme}
          onDragEnd={onDragEnd}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
        />
      </Tldraw>
    </div>
  );
}
