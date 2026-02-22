import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

/* ── Icon Registry ─────────────────────────────────── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let ICONS: IconEntry[] = [];
async function loadIcons() {
  if (ICONS.length) return;
  try { ICONS = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {}
}
function iconPath(name: string, hint?: string): string | null {
  const l = (hint || name).toLowerCase().trim();
  const m = ICONS.find(i => i.id === l) || ICONS.find(i => i.name.toLowerCase() === l) ||
    ICONS.find(i => i.aliases.some(a => a === l || l.includes(a) || a.includes(l)));
  return m ? `/icons/gcp/${m.id}.svg` : null;
}

/* ── Palette ───────────────────────────────────────── */
const CATS = ["actors","channels","ingestion","processing","ai","storage","serving","output","security","monitoring"] as const;
const PAL: Record<string, { bg: string; bd: string; hbg: string; hc: string; ac: string }> = {
  actors:     { bg:"#f8f9fa",bd:"#dee2e6",hbg:"#e9ecef",hc:"#212529",ac:"#495057" },
  channels:   { bg:"#e8f5e9",bd:"#a5d6a7",hbg:"#c8e6c9",hc:"#1b5e20",ac:"#43a047" },
  ingestion:  { bg:"#fff3e0",bd:"#ffcc80",hbg:"#ffe0b2",hc:"#e65100",ac:"#fb8c00" },
  processing: { bg:"#ede7f6",bd:"#b39ddb",hbg:"#d1c4e9",hc:"#4527a0",ac:"#7e57c2" },
  ai:         { bg:"#e3f2fd",bd:"#90caf9",hbg:"#bbdefb",hc:"#0d47a1",ac:"#1e88e5" },
  storage:    { bg:"#fce4ec",bd:"#f48fb1",hbg:"#f8bbd0",hc:"#880e4f",ac:"#e91e63" },
  serving:    { bg:"#e0f7fa",bd:"#80deea",hbg:"#b2ebf2",hc:"#006064",ac:"#00acc1" },
  output:     { bg:"#fff8e1",bd:"#ffe082",hbg:"#ffecb3",hc:"#f57f17",ac:"#ffb300" },
  security:   { bg:"#ffebee",bd:"#ef9a9a",hbg:"#ffcdd2",hc:"#b71c1c",ac:"#e53935" },
  monitoring: { bg:"#e1f5fe",bd:"#81d4fa",hbg:"#b3e5fc",hc:"#01579b",ac:"#039be5" },
};

const TB_COLORS: Record<string, { stroke: string; fill: string; label: string }> = {
  external:   { stroke: "#ef5350", fill: "rgba(239,83,80,0.04)", label: "#c62828" },
  dmz:        { stroke: "#ff9800", fill: "rgba(255,152,0,0.04)", label: "#e65100" },
  vpc:        { stroke: "#42a5f5", fill: "rgba(66,165,245,0.04)", label: "#1565c0" },
  restricted: { stroke: "#ab47bc", fill: "rgba(171,71,188,0.04)", label: "#6a1b9a" },
};

const SEV_COLORS: Record<string, string> = { critical: "#d32f2f", high: "#e65100", medium: "#f9a825", low: "#66bb6a" };
const FLOW_SEC_COLORS = { secure: "#43a047", partial: "#ff9800", exposed: "#e53935" };

const SAMPLES = [
  { label: "Healthcare AI Pipeline", prompt: "Healthcare AI system: Patient data from Epic EHR flows through FHIR API gateway to a data lake in BigQuery. Vertex AI trains clinical prediction models. Models deployed via Cloud Run serving predictions to a clinician dashboard." },
  { label: "E-commerce Platform", prompt: "E-commerce: User clickstream from web app flows through API Gateway to Pub/Sub. Cloud Functions processes events into Firestore. Vertex AI trains recommendation models. Cached in Memorystore, served through Cloud Run to React storefront." },
  { label: "RAG Chatbot", prompt: "RAG chatbot: Documents from Google Drive chunked and embedded via Vertex AI, stored in Cloud SQL pgvector. User queries through React UI hit Cloud Run orchestrator, does retrieval, calls Vertex AI, returns responses." },
];

/* ── Types ─────────────────────────────────────────── */
interface Comp { id: string; name: string; icon?: string; subtitle?: string }
interface Grp { id: string; name: string; category: string; components: Comp[] }
interface Flow { from: string; to: string; label?: string; step?: number }
interface TrustBoundary { id: string; name: string; type: string; groups: string[] }
interface SecFlow { step: number; transport: string; auth: string; dataClassification: string; private: boolean }
interface Secret { component: string; store: string; credential: string; rotation: string }
interface Threat { id: string; location: string; locationType: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance: string | null }
interface Diag {
  title: string; groups: Grp[]; flows: Flow[];
  trustBoundaries?: TrustBoundary[];
  security?: { flows?: SecFlow[]; secrets?: Secret[]; identity?: any };
  threats?: Threat[];
}
interface GPos { x: number; y: number; w: number; h: number }
type Sel = { t: "g"; id: string } | { t: "f"; idx: number } | { t: "threat"; id: string } | null;
type Dir = "h" | "v";

/* ── Layout engine ─────────────────────────────────── */
const IS = 44, CW = 100, CH = 80, CG = 8, PX = 20, PT = 42, PB = 16;
const GM = 100, GC = 40, MG = 60, TH = 50;

function gSz(g: Grp) {
  const n = g.components.length || 1, c = Math.min(n, 2), r = Math.ceil(n / c);
  return { w: Math.max(c * CW + (c - 1) * CG + 2 * PX, 180), h: PT + r * CH + PB };
}

function topoSort(gs: Grp[], fs: Flow[]) {
  const c2g: Record<string, string> = {};
  gs.forEach(g => g.components.forEach(c => { c2g[c.id] = g.id }));
  const adj: Record<string, Set<string>> = {}, ind: Record<string, number> = {};
  gs.forEach(g => { adj[g.id] = new Set(); ind[g.id] = 0 });
  fs.forEach(f => { const a = c2g[f.from], b = c2g[f.to]; if (a && b && a !== b && !adj[a].has(b)) { adj[a].add(b); ind[b]++ } });
  const cols: string[][] = [], vis = new Set<string>();
  let q = gs.map(g => g.id).filter(id => ind[id] === 0);
  while (q.length) { cols.push([...q]); q.forEach(id => vis.add(id)); const nx: string[] = []; q.forEach(id => adj[id].forEach(t => { ind[t]--; if (!ind[t] && !vis.has(t)) nx.push(t) })); q = nx; }
  gs.forEach(g => { if (!vis.has(g.id)) cols.push([g.id]) });
  return cols;
}

function doLayout(gs: Grp[], fs: Flow[], d: Dir): Record<string, GPos> {
  const cols = topoSort(gs, fs), sz: Record<string, { w: number; h: number }> = {};
  gs.forEach(g => { sz[g.id] = gSz(g) });
  const pos: Record<string, GPos> = {};
  if (d === "h") {
    const cw = cols.map(c => Math.max(...c.map(id => sz[id]?.w || 180)));
    const cx: number[] = [MG]; for (let i = 1; i < cols.length; i++) cx.push(cx[i-1] + cw[i-1] + GM);
    cols.forEach((col, ci) => { let y = MG + TH; col.forEach(id => { const s = sz[id]; pos[id] = { x: cx[ci]+(cw[ci]-s.w)/2, y, w: s.w, h: s.h }; y += s.h + GC }) });
  } else {
    const rh = cols.map(c => Math.max(...c.map(id => sz[id]?.h || 150)));
    const ry: number[] = [MG + TH]; for (let i = 1; i < cols.length; i++) ry.push(ry[i-1]+rh[i-1]+GM);
    cols.forEach((col, ri) => { let x = MG; col.forEach(id => { const s = sz[id]; pos[id] = { x, y: ry[ri]+(rh[ri]-s.h)/2, w: s.w, h: s.h }; x += s.w + GC }) });
  }
  return pos;
}

function compXY(g: Grp, p: GPos) {
  const n = g.components.length, c = Math.min(n, 2), r = Math.ceil(n / c);
  const tw = c * CW + (c-1)*CG, th = r * CH;
  const sx = p.x + (p.w-tw)/2, sy = p.y + PT + (p.h-PT-PB-th)/2;
  return g.components.map((comp, i) => ({ cx: sx+(i%c)*(CW+CG)+CW/2, cy: sy+Math.floor(i/c)*CH+CH/2-6, comp }));
}

/* ── Bezier paths ──────────────────────────────────── */
function flowBez(f: Flow, gs: Grp[], pos: Record<string, GPos>, d: Dir) {
  let fg = "", tg = "";
  for (const g of gs) { if (g.components.some(c => c.id === f.from)) fg = g.id; if (g.components.some(c => c.id === f.to)) tg = g.id; }
  const fp = pos[fg], tp = pos[tg]; if (!fp || !tp) return null;
  if (d === "h") {
    const sy = fp.y+fp.h/2, ey = tp.y+tp.h/2, sx = fp.x+fp.w, ex = tp.x;
    if (ex > sx+10) { const c = (ex-sx)*.4; return { d:`M${sx},${sy} C${sx+c},${sy} ${ex-c},${ey} ${ex},${ey}`, lx:(sx+ex)/2, ly:(sy+ey)/2 }; }
    const t = Math.min(fp.y, tp.y)-50;
    return { d:`M${sx},${sy} C${sx+50},${sy} ${sx+50},${t} ${(sx+ex)/2},${t} S${ex-50},${ey} ${ex},${ey}`, lx:(sx+ex)/2, ly:t };
  } else {
    const sx = fp.x+fp.w/2, ex = tp.x+tp.w/2, sy = fp.y+fp.h, ey = tp.y;
    if (ey > sy+10) { const c = (ey-sy)*.4; return { d:`M${sx},${sy} C${sx},${sy+c} ${ex},${ey-c} ${ex},${ey}`, lx:(sx+ex)/2, ly:(sy+ey)/2 }; }
    const l = Math.min(fp.x, tp.x)-50;
    return { d:`M${sx},${sy} C${sx},${sy+50} ${l},${sy+50} ${l},${(sy+ey)/2} S${ex},${ey-50} ${ex},${ey}`, lx:l, ly:(sy+ey)/2 };
  }
}

/* ── Security helpers ──────────────────────────────── */
function flowSecColor(sf?: SecFlow): string {
  if (!sf) return "#c5cae9";
  if (sf.private && sf.transport.toLowerCase().includes("tls")) return FLOW_SEC_COLORS.secure;
  if (sf.auth && sf.auth.toLowerCase() !== "none") return FLOW_SEC_COLORS.partial;
  return FLOW_SEC_COLORS.exposed;
}

/* ── Export ─────────────────────────────────────────── */
function doExport(diag: Diag, pos: Record<string, GPos>) {
  let n = 10; const cs: string[] = [];
  const e = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const gm: Record<string, string> = {};
  diag.groups.forEach(g => { const c = PAL[g.category]||PAL.processing, p = pos[g.id]; if(!p) return; const id = `c${++n}`; gm[g.id] = id;
    cs.push(`<mxCell id="${id}" value="${e(g.name)}" style="rounded=1;whiteSpace=wrap;fillColor=${c.bg};strokeColor=${c.bd};verticalAlign=top;fontStyle=1;fontSize=12;fontColor=${c.hc};" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`); });
  diag.flows.forEach(f => { let fg="",tg=""; diag.groups.forEach(g=>{if(g.components.some(c=>c.id===f.from))fg=g.id;if(g.components.some(c=>c.id===f.to))tg=g.id});
    const s=gm[fg],t=gm[tg]; if(!s||!t) return;
    cs.push(`<mxCell id="c${++n}" value="${f.step||''}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#5c6bc0;strokeWidth=2;endArrow=blockThin;endFill=1;fontSize=11;fontStyle=1;" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry"/></mxCell>`); });
  const xml = `<?xml version="1.0"?>\n<mxfile><diagram name="Arch"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([xml],{type:"application/xml"}));
  a.download = `${diag.title?.replace(/\s+/g,"_")||"arch"}.drawio`; a.click();
}

/* ── Edit Panel ────────────────────────────────────── */
function EditPanel({ diag, setDiag, sel, setSel }: {
  diag: Diag; setDiag: (d: Diag) => void; sel: Sel; setSel: (s: Sel) => void;
}) {
  if (!sel) return null;

  if (sel.t === "g") {
    const g = diag.groups.find(x => x.id === sel.id); if (!g) return null;
    const up = (u: Partial<Grp>) => setDiag({...diag, groups: diag.groups.map(x => x.id===g.id?{...x,...u}:x)});
    const upC = (cid: string, u: Partial<Comp>) => up({components: g.components.map(c => c.id===cid?{...c,...u}:c)});
    const delC = (cid: string) => setDiag({...diag, groups: diag.groups.map(x => x.id===g.id?{...x,components:x.components.filter(c=>c.id!==cid)}:x), flows: diag.flows.filter(f=>f.from!==cid&&f.to!==cid)});
    const addC = () => up({components: [...g.components, {id:`n${Date.now()}`, name:"New Service"}]});
    const delG = () => { const ids = new Set(g.components.map(c=>c.id)); setDiag({...diag, groups:diag.groups.filter(x=>x.id!==g.id), flows:diag.flows.filter(f=>!ids.has(f.from)&&!ids.has(f.to))}); setSel(null); };
    return (
      <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#555"}}>✎ EDIT GROUP</span>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,padding:0,lineHeight:"1"}}>×</button>
        </div>
        <div><label style={{fontSize:10,color:"#999",display:"block",marginBottom:3}}>Name</label>
          <input value={g.name} onChange={e=>up({name:e.target.value})} style={{width:"100%",padding:"6px 8px",border:"1px solid #ddd",borderRadius:5,fontSize:12,outline:"none",boxSizing:"border-box"}} /></div>
        <div><label style={{fontSize:10,color:"#999",display:"block",marginBottom:4}}>Color</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {CATS.map(c=><button key={c} onClick={()=>up({category:c})} title={c} style={{width:24,height:24,borderRadius:6,background:PAL[c].ac,border:g.category===c?"2.5px solid #222":"2.5px solid transparent",cursor:"pointer",color:"#fff",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center"}}>{g.category===c?"✓":""}</button>)}
          </div></div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <label style={{fontSize:10,color:"#999"}}>Components</label>
            <button onClick={addC} style={{background:"#eee",border:"none",borderRadius:4,padding:"2px 8px",fontSize:10,cursor:"pointer"}}>+ Add</button>
          </div>
          {g.components.map(c=>(
            <div key={c.id} style={{padding:6,background:"#fafafa",borderRadius:5,marginBottom:4,border:"1px solid #eee"}}>
              <div style={{display:"flex",gap:4}}>
                <input value={c.name} onChange={e=>upC(c.id,{name:e.target.value})} style={{flex:1,padding:"3px 6px",border:"1px solid #eee",borderRadius:4,fontSize:11,outline:"none"}} />
                <button onClick={()=>delC(c.id)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:14}}>×</button>
              </div>
              <input value={c.subtitle||""} onChange={e=>upC(c.id,{subtitle:e.target.value})} placeholder="subtitle" style={{width:"100%",padding:"2px 6px",border:"1px solid #eee",borderRadius:4,fontSize:9,outline:"none",color:"#999",marginTop:3,boxSizing:"border-box"}} />
            </div>
          ))}
        </div>
        <button onClick={delG} style={{padding:"6px 0",background:"#fff5f5",border:"1px solid #fecaca",borderRadius:5,fontSize:10,color:"#dc2626",cursor:"pointer"}}>Delete Group</button>
      </div>
    );
  }

  if (sel.t === "f") {
    const f = diag.flows[sel.idx]; if (!f) return null;
    const sf = diag.security?.flows?.find(s => s.step === f.step);
    const fN = diag.groups.flatMap(g=>g.components).find(c=>c.id===f.from)?.name||f.from;
    const tN = diag.groups.flatMap(g=>g.components).find(c=>c.id===f.to)?.name||f.to;
    const reverse = () => { const nf=[...diag.flows]; nf[sel.idx]={...f,from:f.to,to:f.from}; setDiag({...diag,flows:nf}); };
    const upLabel = (label: string) => { const nf=[...diag.flows]; nf[sel.idx]={...f,label}; setDiag({...diag,flows:nf}); };
    const del = () => { setDiag({...diag,flows:diag.flows.filter((_,i)=>i!==sel.idx)}); setSel(null); };
    return (
      <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#555"}}>✎ FLOW STEP {f.step}</span>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,padding:0,lineHeight:"1"}}>×</button>
        </div>
        <div style={{padding:8,background:"#f5f5ff",borderRadius:6,fontSize:12}}><b>{fN}</b><span style={{color:"#999",margin:"0 6px"}}>→</span><b>{tN}</b></div>
        <div><label style={{fontSize:10,color:"#999",display:"block",marginBottom:3}}>Label</label>
          <input value={f.label||""} onChange={e=>upLabel(e.target.value)} style={{width:"100%",padding:"5px 8px",border:"1px solid #ddd",borderRadius:5,fontSize:12,outline:"none",boxSizing:"border-box"}} /></div>
        {sf && (
          <div style={{padding:8,background:"#f8f9fa",borderRadius:6,fontSize:10,display:"flex",flexDirection:"column",gap:4}}>
            <div><b>Transport:</b> {sf.transport}</div>
            <div><b>Auth:</b> {sf.auth}</div>
            <div><b>Data:</b> <span style={{color:sf.dataClassification==="regulated"?"#c62828":sf.dataClassification==="confidential"?"#e65100":"#333"}}>{sf.dataClassification}</span></div>
            <div><b>Private:</b> {sf.private?"Yes ✓":"No ✗"}</div>
          </div>
        )}
        <div style={{display:"flex",gap:6}}>
          <button onClick={reverse} style={{flex:1,padding:6,background:"#f5f5f5",border:"1px solid #eee",borderRadius:5,fontSize:10,cursor:"pointer"}}>⇄ Reverse</button>
          <button onClick={del} style={{flex:1,padding:6,background:"#fff5f5",border:"1px solid #fecaca",borderRadius:5,fontSize:10,color:"#dc2626",cursor:"pointer"}}>Delete</button>
        </div>
      </div>
    );
  }

  if (sel.t === "threat") {
    const th = diag.threats?.find(t => t.id === sel.id); if (!th) return null;
    return (
      <div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:700,color:SEV_COLORS[th.severity]||"#999"}}>⚠ THREAT — {th.severity.toUpperCase()}</span>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,padding:0,lineHeight:"1"}}>×</button>
        </div>
        <div style={{fontSize:13,fontWeight:600,color:"#333"}}>{th.title}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <span style={{padding:"2px 8px",background:"#f0f0f0",borderRadius:4,fontSize:9,fontWeight:700}}>STRIDE: {th.stride}</span>
          {th.compliance && <span style={{padding:"2px 8px",background:"#fff3e0",borderRadius:4,fontSize:9,fontWeight:700,color:"#e65100"}}>{th.compliance}</span>}
        </div>
        <div style={{fontSize:11,color:"#555",lineHeight:1.5}}>{th.description}</div>
        <div style={{padding:8,background:"#fff5f5",borderRadius:6,fontSize:10}}><b>Impact:</b> {th.impact}</div>
        <div style={{padding:8,background:"#f1f8e9",borderRadius:6,fontSize:10}}><b>Mitigation:</b> {th.mitigation}</div>
      </div>
    );
  }
  return null;
}

/* ── Threat Register (sidebar) ─────────────────────── */
function ThreatList({ threats, sel, setSel }: { threats: Threat[]; sel: Sel; setSel: (s: Sel) => void }) {
  if (!threats?.length) return null;
  const sorted = [...threats].sort((a, b) => {
    const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (o[a.severity] ?? 4) - (o[b.severity] ?? 4);
  });
  return (
    <div style={{marginTop:4}}>
      <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:1,marginBottom:6}}>THREAT REGISTER</div>
      {sorted.map(t => {
        const active = sel?.t === "threat" && sel.id === t.id;
        return (
          <button key={t.id} onClick={() => setSel({ t: "threat", id: t.id })}
            style={{width:"100%",textAlign:"left",padding:"6px 8px",marginBottom:3,borderRadius:5,cursor:"pointer",
              background: active ? "#fff5f5" : "#fafafa", border: active ? `1px solid ${SEV_COLORS[t.severity]}` : "1px solid #f0f0f0",
              display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:2,background:SEV_COLORS[t.severity],flexShrink:0}} />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,fontWeight:600,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
              <div style={{fontSize:8,color:"#999"}}>{t.stride} · {t.locationType === "flow" ? `Step ${t.location}` : t.location}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── SVG Canvas ────────────────────────────────────── */
function Canvas({ diag, setDiag, pos, setPos, sel, setSel, dir }: {
  diag: Diag; setDiag: (d: Diag) => void; pos: Record<string, GPos>; setPos: (p: Record<string, GPos>) => void;
  sel: Sel; setSel: (s: Sel) => void; dir: Dir;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wasDrag = useRef(false);
  const dragInfo = useRef<{ gid: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hFlow, setHFlow] = useState<number | null>(null);
  const posRef = useRef(pos); posRef.current = pos;

  let mx = 0, my = 0;
  Object.values(pos).forEach(p => { mx = Math.max(mx, p.x+p.w); my = Math.max(my, p.y+p.h) });
  const W = Math.max(mx+MG+20, 500), H = Math.max(my+MG+20, 350);
  const wRef = useRef(W); wRef.current = W;

  // Drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragInfo.current; if (!d) return;
      const dx = e.clientX-d.sx, dy = e.clientY-d.sy;
      if (!wasDrag.current && Math.abs(dx)<5 && Math.abs(dy)<5) return;
      wasDrag.current = true; setDragging(true);
      const el = svgRef.current; if (!el) return;
      const r = el.getBoundingClientRect(), s = wRef.current/r.width;
      const c = posRef.current;
      setPos({...c, [d.gid]: {...c[d.gid], x: Math.max(10, d.ox+dx*s), y: Math.max(10, d.oy+dy*s)}});
    };
    const onUp = () => { dragInfo.current = null; setDragging(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [setPos]);

  const onGDown = (gid: string, e: React.MouseEvent) => {
    e.preventDefault(); const p = pos[gid]; if (!p) return;
    wasDrag.current = false; dragInfo.current = { gid, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
  };
  const onGClick = (gid: string, e: React.MouseEvent) => { e.stopPropagation(); if (wasDrag.current) { wasDrag.current=false; return; } setSel({t:"g",id:gid}); };
  const onFClick = (idx: number, e: React.MouseEvent) => { e.stopPropagation(); setSel({t:"f",idx}); };
  const onBg = () => { if (!wasDrag.current) setSel(null); };

  // Trust boundary rectangles
  const tbRects = (diag.trustBoundaries || []).map(tb => {
    const gps = tb.groups.map(gid => pos[gid]).filter(Boolean);
    if (!gps.length) return null;
    const pad = 16;
    const x1 = Math.min(...gps.map(p => p.x)) - pad;
    const y1 = Math.min(...gps.map(p => p.y)) - pad - 14;
    const x2 = Math.max(...gps.map(p => p.x + p.w)) + pad;
    const y2 = Math.max(...gps.map(p => p.y + p.h)) + pad;
    const col = TB_COLORS[tb.type] || TB_COLORS.vpc;
    return { tb, x: x1, y: y1, w: x2-x1, h: y2-y1, col };
  }).filter(Boolean) as { tb: TrustBoundary; x: number; y: number; w: number; h: number; col: typeof TB_COLORS.vpc }[];

  // Map threat locations to positions
  const threatMarkers = (diag.threats || []).map(th => {
    if (th.locationType === "flow") {
      const step = parseInt(th.location);
      const f = diag.flows.find(fl => fl.step === step);
      if (!f) return null;
      const b = flowBez(f, diag.groups, pos, dir);
      if (!b) return null;
      return { th, x: b.lx, y: b.ly - 22 };
    } else {
      // Component threat — find component position
      for (const g of diag.groups) {
        const ci = g.components.findIndex(c => c.id === th.location);
        if (ci >= 0 && pos[g.id]) {
          const cp = compXY(g, pos[g.id]);
          if (cp[ci]) return { th, x: cp[ci].cx + IS/2 + 2, y: cp[ci].cy - IS/2 - 2 };
        }
      }
      return null;
    }
  }).filter(Boolean) as { th: Threat; x: number; y: number }[];

  return (
    <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{display:"block",fontFamily:"'DM Sans',system-ui,sans-serif",cursor:dragging?"grabbing":"default"}}
      onClick={onBg}>
      <defs>
        <marker id="ma" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#5c6bc0"/></marker>
        <marker id="mag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill={FLOW_SEC_COLORS.secure}/></marker>
        <marker id="may" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill={FLOW_SEC_COLORS.partial}/></marker>
        <marker id="mar" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill={FLOW_SEC_COLORS.exposed}/></marker>
        <marker id="mah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#283593"/></marker>
        <filter id="gs"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity=".06"/></filter>
        <filter id="gsd"><feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity=".12"/></filter>
        <filter id="is"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity=".06"/></filter>
      </defs>
      <style>{`@keyframes flowmove{to{stroke-dashoffset:-20}}.afl{stroke-dasharray:6 4;animation:flowmove .6s linear infinite}.afli{}`}</style>
      <rect width={W} height={H} fill="#fff"/>
      <text x={W/2} y={36} textAnchor="middle" style={{fontSize:18,fontWeight:700,fill:"#111"}}>{diag.title}</text>

      {/* Trust boundaries */}
      {tbRects.map(({tb, x, y, w, h, col}) => (
        <g key={tb.id}>
          <rect x={x} y={y} width={w} height={h} rx={12} fill={col.fill} stroke={col.stroke} strokeWidth={2} strokeDasharray="8 4" />
          <text x={x+8} y={y+12} style={{fontSize:9,fontWeight:700,fill:col.label,letterSpacing:.5}}>{tb.name.toUpperCase()}</text>
        </g>
      ))}

      {/* Flow arrows */}
      {diag.flows.map((f, fi) => {
        const b = flowBez(f, diag.groups, pos, dir); if (!b) return null;
        const sf = diag.security?.flows?.find(s => s.step === f.step);
        const sc = flowSecColor(sf);
        const active = hFlow === fi || (sel?.t === "f" && sel.idx === fi);
        const markerMap: Record<string, string> = { [FLOW_SEC_COLORS.secure]: "url(#mag)", [FLOW_SEC_COLORS.partial]: "url(#may)", [FLOW_SEC_COLORS.exposed]: "url(#mar)" };
        const marker = active ? "url(#mah)" : (markerMap[sc] || "url(#ma)");
        return (
          <g key={`f${fi}`} onMouseEnter={()=>setHFlow(fi)} onMouseLeave={()=>setHFlow(null)}
            onClick={e=>onFClick(fi,e)} style={{cursor:"pointer"}}>
            <path d={b.d} fill="none" stroke="transparent" strokeWidth={20}/>
            <path d={b.d} fill="none" className={active?"afl":"afli"}
              stroke={active?"#283593":sc} strokeWidth={active?3:2.2} markerEnd={marker}/>
            {/* Step badge */}
            <circle cx={b.lx} cy={b.ly} r={12} fill={active?"#283593":"#5c6bc0"}/>
            <text x={b.lx} y={b.ly+4} textAnchor="middle" style={{fontSize:10,fontWeight:800,fill:"#fff",pointerEvents:"none"}}>{f.step}</text>
            {/* Lock icon for private encrypted */}
            {sf?.private && sf?.transport?.toLowerCase().includes("tls") && (
              <g transform={`translate(${b.lx+15},${b.ly-2})`}>
                <rect x={-5} y={-3} width={10} height={8} rx={1.5} fill="#fff" stroke={FLOW_SEC_COLORS.secure} strokeWidth={1.2}/>
                <path d={`M-3,-3 L-3,-6 A3,3 0 0,1 3,-6 L3,-3`} fill="none" stroke={FLOW_SEC_COLORS.secure} strokeWidth={1.2}/>
              </g>
            )}
            {/* Hover tooltip */}
            {active && (
              <g>
                <rect x={b.lx-80} y={b.ly+18} width={160} height={sf?50:20} rx={5} fill="#1a237e" opacity={.93}/>
                <text x={b.lx} y={b.ly+32} textAnchor="middle" style={{fontSize:9,fill:"#fff",fontWeight:600}}>{f.label||"(no label)"}</text>
                {sf && <>
                  <text x={b.lx} y={b.ly+44} textAnchor="middle" style={{fontSize:8,fill:"#b3c0ff"}}>{sf.transport} · {sf.auth}</text>
                  <text x={b.lx} y={b.ly+55} textAnchor="middle" style={{fontSize:8,fill:sf.dataClassification==="regulated"?"#ff8a80":sf.dataClassification==="confidential"?"#ffcc80":"#c5e1a5"}}>{sf.dataClassification}{sf.private?" · Private":" · Public"}</text>
                </>}
              </g>
            )}
          </g>
        );
      })}

      {/* Groups */}
      {diag.groups.map(g => {
        const p = pos[g.id]; if(!p) return null;
        const c = PAL[g.category]||PAL.processing;
        const isD = dragging && dragInfo.current?.gid===g.id;
        const isS = sel?.t==="g" && sel.id===g.id;
        // Secrets on this group's components
        const secrets = (diag.security?.secrets||[]).filter(s => g.components.some(c => c.id===s.component));
        return (
          <g key={g.id}>
            <g onMouseDown={e=>onGDown(g.id,e)} onClick={e=>onGClick(g.id,e)} style={{cursor:isD?"grabbing":"grab"}}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={10} fill={c.bg} stroke={isS?c.ac:c.bd} strokeWidth={isS?2.5:1.2} filter={isD?"url(#gsd)":"url(#gs)"}/>
              <rect x={p.x} y={p.y} width={p.w} height={34} rx={10} fill={c.hbg}/>
              <rect x={p.x} y={p.y+24} width={p.w} height={10} fill={c.hbg}/>
              <rect x={p.x+10} y={p.y} width={p.w-20} height={3} rx={1.5} fill={c.ac}/>
              <text x={p.x+p.w/2} y={p.y+24} textAnchor="middle" style={{fontSize:12,fontWeight:700,fill:c.hc,pointerEvents:"none"}}>{g.name}</text>
            </g>
            {/* Secret indicator */}
            {secrets.length > 0 && (
              <g transform={`translate(${p.x+p.w-18},${p.y+6})`}>
                <circle r={7} fill="#fff" stroke="#ff9800" strokeWidth={1.5}/>
                <text y={3.5} textAnchor="middle" style={{fontSize:8,fill:"#ff9800",fontWeight:800}}>🔑</text>
              </g>
            )}
            {compXY(g,p).map(({cx,cy,comp})=>{
              const ip = iconPath(comp.name, comp.icon);
              return (
                <g key={comp.id}>
                  {ip?<image href={ip} x={cx-IS/2} y={cy-IS/2} width={IS} height={IS} filter="url(#is)"/>
                    :<g><rect x={cx-20} y={cy-20} width={40} height={40} rx={8} fill="#f0f0f0" stroke="#ddd" filter="url(#is)"/>
                      <text x={cx} y={cy+5} textAnchor="middle" style={{fontSize:14,fill:"#aaa"}}>?</text></g>}
                  <text x={cx} y={cy+IS/2+12} textAnchor="middle" style={{fontSize:10,fontWeight:500,fill:"#444",pointerEvents:"none"}}>
                    {comp.name.length>14?comp.name.slice(0,13)+"…":comp.name}</text>
                  {comp.subtitle&&<text x={cx} y={cy+IS/2+23} textAnchor="middle" style={{fontSize:8,fill:"#aaa",pointerEvents:"none"}}>{comp.subtitle}</text>}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Threat markers */}
      {threatMarkers.map(({th, x, y}) => {
        const active = sel?.t === "threat" && sel.id === th.id;
        const col = SEV_COLORS[th.severity] || SEV_COLORS.medium;
        return (
          <g key={th.id} onClick={e => { e.stopPropagation(); setSel({t:"threat",id:th.id}); }} style={{cursor:"pointer"}}>
            <polygon points={`${x},${y-10} ${x-8},${y+4} ${x+8},${y+4}`}
              fill={active?"#fff":col} stroke={col} strokeWidth={active?2:1.5}/>
            <text x={x} y={y+1} textAnchor="middle" style={{fontSize:7,fontWeight:800,fill:active?col:"#fff",pointerEvents:"none"}}>!</text>
            {/* Severity dot */}
            <text x={x+10} y={y} style={{fontSize:7,fill:col,fontWeight:700,pointerEvents:"none"}}>{th.stride}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Dashboard ─────────────────────────────────────── */
export default function Dashboard({ user }: { user: User }) {
  const { logout, isLoggingOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diag, setDiag] = useState<Diag | null>(null);
  const [pos, setPos] = useState<Record<string, GPos>>({});
  const [sel, setSel] = useState<Sel>(null);
  const [dir, setDir] = useState<Dir>("h");

  useEffect(() => { loadIcons() }, []);

  const updateDiag = useCallback((d: Diag) => {
    setDiag(d);
    const np = {...pos};
    d.groups.forEach(g => { const s = gSz(g); if(np[g.id]) np[g.id]={...np[g.id],w:s.w,h:s.h}; else { const a=doLayout(d.groups,d.flows,dir); if(a[g.id]) np[g.id]=a[g.id]; } });
    Object.keys(np).forEach(k=>{if(!d.groups.find(g=>g.id===k)) delete np[k]});
    setPos(np);
  }, [pos, dir]);

  const generate = useCallback(async () => {
    if(!prompt.trim()) return;
    setLoading(true); setError(""); setDiag(null); setSel(null);
    try {
      const res = await fetch("/api/diagrams/generate",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({prompt})});
      if(!res.ok) throw new Error((await res.json()).error||"Failed");
      const d = (await res.json()).diagram as Diag;
      setDiag(d); setPos(doLayout(d.groups, d.flows, dir));
    } catch(e:any){setError(e.message)}
    setLoading(false);
  }, [prompt, dir]);

  const reLayout = (d: Dir) => { setDir(d); if(diag) setPos(doLayout(diag.groups,diag.flows,d)) };
  const reset = () => { if(diag){setPos(doLayout(diag.groups,diag.flows,dir));setSel(null)} };

  return (
    <div style={{minHeight:"100vh",background:"#fff",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .3s ease-out}
        textarea:focus{border-color:#333!important;background:#fff!important}
        input:focus{border-color:#999!important}
      `}</style>

      {/* Header */}
      <div style={{height:52,padding:"0 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:"#212529",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12}}>◇</div>
          <span style={{fontSize:14,fontWeight:700}}>ArchGen</span>
          <span style={{fontSize:9,background:"#f5f5f5",color:"#999",padding:"2px 6px",borderRadius:3,fontWeight:600}}>BETA</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {diag&&<>
            <div style={{display:"flex",border:"1px solid #eee",borderRadius:6,overflow:"hidden"}}>
              <button onClick={()=>reLayout("h")} style={{padding:"4px 10px",fontSize:11,border:"none",cursor:"pointer",background:dir==="h"?"#212529":"#fff",color:dir==="h"?"#fff":"#999"}}>↔</button>
              <button onClick={()=>reLayout("v")} style={{padding:"4px 10px",fontSize:11,border:"none",cursor:"pointer",borderLeft:"1px solid #eee",background:dir==="v"?"#212529":"#fff",color:dir==="v"?"#fff":"#999"}}>↕</button>
            </div>
            <button onClick={reset} style={{background:"none",border:"1px solid #eee",padding:"4px 10px",borderRadius:6,fontSize:11,color:"#999",cursor:"pointer"}}>⟲</button>
            <button onClick={()=>doExport(diag,pos)} style={{background:"#212529",color:"#fff",border:"none",padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>↓ .drawio</button>
          </>}
          <span style={{fontSize:12,color:"#aaa"}}>{user.firstName||user.email}</span>
          <button onClick={()=>logout()} disabled={isLoggingOut} style={{background:"none",border:"1px solid #eee",padding:"4px 10px",borderRadius:6,fontSize:11,color:"#999",cursor:"pointer"}}>Logout</button>
        </div>
      </div>

      <div style={{display:"flex",height:"calc(100vh - 52px)"}}>
        {/* Sidebar */}
        <div style={{width:300,borderRight:"1px solid #f0f0f0",padding:14,display:"flex",flexDirection:"column",gap:10,overflowY:"auto",flexShrink:0}}>
          <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:1}}>DESCRIBE YOUR SYSTEM</div>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)) generate()}}
            placeholder="Describe your architecture..."
            style={{width:"100%",minHeight:100,padding:10,border:"1px solid #eee",borderRadius:8,fontSize:12,color:"#333",outline:"none",resize:"vertical",lineHeight:1.6,background:"#fafafa",boxSizing:"border-box"}} />
          <button onClick={generate} disabled={loading||!prompt.trim()}
            style={{width:"100%",padding:"9px 0",background:loading?"#666":"#212529",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,
              cursor:loading?"wait":"pointer",opacity:!prompt.trim()?0.3:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading&&<div style={{width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}
            {loading?"Generating...":"Generate Diagram"}
          </button>
          {error&&<div style={{padding:8,borderRadius:6,background:"#fff5f5",border:"1px solid #fecaca",color:"#dc2626",fontSize:11}}>{error}</div>}

          {/* Edit panel OR templates + threat register */}
          {diag && sel ? (
            <EditPanel diag={diag} setDiag={updateDiag} sel={sel} setSel={setSel} />
          ) : (
            <>
              {!diag && <>
                <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:1,marginTop:4}}>TEMPLATES</div>
                {SAMPLES.map((s,i)=>(
                  <button key={i} onClick={()=>setPrompt(s.prompt)} style={{width:"100%",textAlign:"left",padding:"8px 10px",background:"#fafafa",border:"1px solid #f0f0f0",borderRadius:6,cursor:"pointer"}}>
                    <div style={{fontSize:11,fontWeight:600,color:"#333"}}>{s.label}</div>
                    <div style={{fontSize:9,color:"#aaa",marginTop:2}}>{s.prompt.slice(0,70)}...</div>
                  </button>
                ))}
              </>}
              {diag && <>
                <div style={{padding:12,color:"#aaa",fontSize:11,textAlign:"center"}}>Click groups, arrows, or ⚠ threats to inspect</div>
                <ThreatList threats={diag.threats || []} sel={sel} setSel={setSel} />
              </>}
            </>
          )}

          {/* Stats */}
          {diag && (
            <div style={{padding:10,background:"#f8f9fa",borderRadius:6,border:"1px solid #f0f0f0",marginTop:"auto"}}>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                {[{n:diag.groups.length,l:"Groups"},{n:diag.flows.length,l:"Flows"},
                  {n:diag.threats?.length||0,l:"Threats"},{n:diag.trustBoundaries?.length||0,l:"Zones"}].map((s,i)=>(
                  <div key={i}><div style={{fontSize:14,fontWeight:700,color:"#212529"}}>{s.n}</div><div style={{fontSize:8,color:"#aaa"}}>{s.l}</div></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{flex:1,overflow:"auto",padding:20,background:"#f5f5f5"}}>
          {!diag&&!loading&&(
            <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
              <div style={{fontSize:40,color:"#ddd"}}>◇</div>
              <div style={{color:"#bbb",fontSize:13}}>Describe a system to generate its architecture diagram</div>
            </div>
          )}
          {loading&&(
            <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
              <div style={{width:28,height:28,border:"3px solid #e5e5e5",borderTopColor:"#212529",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
              <div style={{color:"#999",fontSize:13}}>Generating architecture story...</div>
            </div>
          )}
          {diag && Object.keys(pos).length>0 && (
            <div className="fade-up" style={{background:"#fff",borderRadius:10,border:"1px solid #e5e5e5",display:"inline-block",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
              <Canvas diag={diag} setDiag={updateDiag} pos={pos} setPos={setPos} sel={sel} setSel={setSel} dir={dir}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
