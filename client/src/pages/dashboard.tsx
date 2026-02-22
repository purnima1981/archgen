import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/models/auth";

/* ── Icons ─────────────────────────────────────────── */
interface IconEntry { id: string; name: string; path: string; aliases: string[] }
let IC: IconEntry[] = [];
async function loadIcons() { if (IC.length) return; try { IC = (await (await fetch("/icons/registry.json")).json()).icons || []; } catch {} }
function iconPath(n: string, h?: string): string | null {
  const l = (h || n).toLowerCase().trim();
  const m = IC.find(i => i.id === l) || IC.find(i => i.name.toLowerCase() === l) || IC.find(i => i.aliases.some(a => a === l || l.includes(a) || a.includes(l)));
  return m ? `/icons/gcp/${m.id}.svg` : null;
}

/* ── Palette ───────────────────────────────────────── */
const CATS = ["actors","channels","ingestion","processing","ai","storage","serving","output","security","monitoring"] as const;
const P: Record<string, { bg: string; bd: string; hbg: string; hc: string; ac: string }> = {
  actors:{bg:"#f8f9fa",bd:"#dee2e6",hbg:"#e9ecef",hc:"#212529",ac:"#495057"},
  channels:{bg:"#e8f5e9",bd:"#a5d6a7",hbg:"#c8e6c9",hc:"#1b5e20",ac:"#43a047"},
  ingestion:{bg:"#fff3e0",bd:"#ffcc80",hbg:"#ffe0b2",hc:"#e65100",ac:"#fb8c00"},
  processing:{bg:"#ede7f6",bd:"#b39ddb",hbg:"#d1c4e9",hc:"#4527a0",ac:"#7e57c2"},
  ai:{bg:"#e3f2fd",bd:"#90caf9",hbg:"#bbdefb",hc:"#0d47a1",ac:"#1e88e5"},
  storage:{bg:"#fce4ec",bd:"#f48fb1",hbg:"#f8bbd0",hc:"#880e4f",ac:"#e91e63"},
  serving:{bg:"#e0f7fa",bd:"#80deea",hbg:"#b2ebf2",hc:"#006064",ac:"#00acc1"},
  output:{bg:"#fff8e1",bd:"#ffe082",hbg:"#ffecb3",hc:"#f57f17",ac:"#ffb300"},
  security:{bg:"#ffebee",bd:"#ef9a9a",hbg:"#ffcdd2",hc:"#b71c1c",ac:"#e53935"},
  monitoring:{bg:"#e1f5fe",bd:"#81d4fa",hbg:"#b3e5fc",hc:"#01579b",ac:"#039be5"},
};
const TB: Record<string, { s: string; f: string; l: string }> = {
  external:{s:"#ef5350",f:"rgba(239,83,80,.04)",l:"#c62828"},
  dmz:{s:"#ff9800",f:"rgba(255,152,0,.04)",l:"#e65100"},
  vpc:{s:"#42a5f5",f:"rgba(66,165,245,.04)",l:"#1565c0"},
  restricted:{s:"#ab47bc",f:"rgba(171,71,188,.04)",l:"#6a1b9a"},
};
const SEV: Record<string, string> = { critical:"#d32f2f", high:"#e65100", medium:"#f9a825", low:"#66bb6a" };

const SAMPLES = [
  { label: "Healthcare AI Pipeline", prompt: "Healthcare AI system: Patient data from Epic EHR flows through FHIR API gateway to a data lake in BigQuery. Vertex AI trains clinical prediction models. Models deployed via Cloud Run serving predictions to a clinician dashboard." },
  { label: "E-commerce Recommendations", prompt: "E-commerce: User clickstream from web app flows through API Gateway to Pub/Sub. Cloud Functions processes events into Firestore. Vertex AI trains recommendation models. Cached in Memorystore, served through Cloud Run to React storefront." },
  { label: "RAG Chatbot", prompt: "RAG chatbot: Documents from Google Drive chunked and embedded via Vertex AI, stored in Cloud SQL pgvector. User queries through React UI hit Cloud Run orchestrator, does retrieval, calls Vertex AI, returns responses." },
];

/* ── Types ──────────────────────────────────────────── */
interface Comp { id: string; name: string; icon?: string; subtitle?: string }
interface Grp { id: string; name: string; category: string; components: Comp[] }
interface Flow { from: string; to: string; label?: string; subtitle?: string; step?: number }
interface TBound { id: string; name: string; type: string; groups: string[] }
interface SecFlow { step: number; transport: string; auth: string; dataClassification: string; private: boolean }
interface Secret { component: string; store: string; credential: string; rotation: string }
interface Threat { id: string; location: string; locationType: string; stride: string; severity: string; title: string; description: string; impact: string; mitigation: string; compliance: string | null }
interface Diag {
  title: string; subtitle?: string; groups: Grp[]; flows: Flow[];
  trustBoundaries?: TBound[]; security?: { flows?: SecFlow[]; secrets?: Secret[] }; threats?: Threat[];
}
interface GPos { x: number; y: number; w: number; h: number }
type Sel = { t: "g"; id: string } | { t: "f"; idx: number } | { t: "th"; id: string } | null;

/* ── Layout ─────────────────────────────────────────── */
const IS = 44, CW = 110, CH = 82, CG = 10, PX = 20, PT = 44, PB = 18, GM = 110, GC = 44, MG = 60, TH = 70;
function gSz(g: Grp) { const n = g.components.length||1, c = Math.min(n,2), r = Math.ceil(n/c); return { w: Math.max(c*CW+(c-1)*CG+2*PX, 200), h: PT+r*CH+PB }; }

function topoSort(gs: Grp[], fs: Flow[]) {
  const c2g: Record<string,string> = {}; gs.forEach(g => g.components.forEach(c => { c2g[c.id]=g.id }));
  const adj: Record<string,Set<string>> = {}, ind: Record<string,number> = {};
  gs.forEach(g => { adj[g.id]=new Set(); ind[g.id]=0 });
  fs.forEach(f => { const a=c2g[f.from],b=c2g[f.to]; if(a&&b&&a!==b&&!adj[a].has(b)){adj[a].add(b);ind[b]++} });
  const cols: string[][] = [], vis = new Set<string>();
  let q = gs.map(g=>g.id).filter(id=>ind[id]===0);
  while(q.length){cols.push([...q]);q.forEach(id=>vis.add(id));const nx:string[]=[];q.forEach(id=>adj[id].forEach(t=>{ind[t]--;if(!ind[t]&&!vis.has(t))nx.push(t)}));q=nx;}
  gs.forEach(g=>{if(!vis.has(g.id))cols.push([g.id])});return cols;
}

function doLayout(gs: Grp[], fs: Flow[]): Record<string,GPos> {
  const cols=topoSort(gs,fs), sz:Record<string,{w:number;h:number}>={}; gs.forEach(g=>{sz[g.id]=gSz(g)});
  const pos:Record<string,GPos>={};
  const cw=cols.map(c=>Math.max(...c.map(id=>sz[id]?.w||200)));
  const cx:number[]=[MG]; for(let i=1;i<cols.length;i++) cx.push(cx[i-1]+cw[i-1]+GM);
  cols.forEach((col,ci)=>{let y=MG+TH;col.forEach(id=>{const s=sz[id];pos[id]={x:cx[ci]+(cw[ci]-s.w)/2,y,w:s.w,h:s.h};y+=s.h+GC})});
  return pos;
}

function compXY(g: Grp, p: GPos) {
  const n=g.components.length,c=Math.min(n,2),r=Math.ceil(n/c);
  const tw=c*CW+(c-1)*CG, th=r*CH, sx=p.x+(p.w-tw)/2, sy=p.y+PT+(p.h-PT-PB-th)/2;
  return g.components.map((comp,i)=>({cx:sx+(i%c)*(CW+CG)+CW/2, cy:sy+Math.floor(i/c)*CH+CH/2-6, comp}));
}

/* ── Bezier ─────────────────────────────────────────── */
function flowBez(f: Flow, gs: Grp[], pos: Record<string,GPos>) {
  let fg="",tg=""; for(const g of gs){if(g.components.some(c=>c.id===f.from))fg=g.id;if(g.components.some(c=>c.id===f.to))tg=g.id;}
  const fp=pos[fg],tp=pos[tg]; if(!fp||!tp)return null;
  const sy=fp.y+fp.h/2, ey=tp.y+tp.h/2, sx=fp.x+fp.w, ex=tp.x;
  if(ex>sx+10){const c=(ex-sx)*.4;return{d:`M${sx},${sy} C${sx+c},${sy} ${ex-c},${ey} ${ex},${ey}`,lx:(sx+ex)/2,ly:(sy+ey)/2};}
  const t=Math.min(fp.y,tp.y)-60;
  return{d:`M${sx},${sy} C${sx+60},${sy} ${sx+60},${t} ${(sx+ex)/2},${t} S${ex-60},${ey} ${ex},${ey}`,lx:(sx+ex)/2,ly:t};
}

function secColor(sf?: SecFlow) {
  if(!sf) return "#c5cae9";
  if(sf.private && sf.transport?.toLowerCase().includes("tls")) return "#43a047";
  if(sf.auth && sf.auth.toLowerCase()!=="none") return "#ff9800";
  return "#e53935";
}

/* ── Export ─────────────────────────────────────────── */
function doExport(diag: Diag, pos: Record<string,GPos>) {
  let n=10;const cs:string[]=[];
  const e=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const gm:Record<string,string>={};
  diag.groups.forEach(g=>{const c=P[g.category]||P.processing,p=pos[g.id];if(!p)return;const id=`c${++n}`;gm[g.id]=id;
    cs.push(`<mxCell id="${id}" value="${e(g.name)}" style="rounded=1;whiteSpace=wrap;fillColor=${c.bg};strokeColor=${c.bd};verticalAlign=top;fontStyle=1;fontSize=12;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`);});
  diag.flows.forEach(f=>{let fg="",tg="";diag.groups.forEach(g=>{if(g.components.some(c=>c.id===f.from))fg=g.id;if(g.components.some(c=>c.id===f.to))tg=g.id;});
    const s=gm[fg],t=gm[tg];if(!s||!t)return;
    cs.push(`<mxCell id="c${++n}" value="${f.step}: ${e(f.label||'')}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;strokeColor=#5c6bc0;strokeWidth=2;endArrow=blockThin;endFill=1;" edge="1" parent="1" source="${s}" target="${t}"><mxGeometry relative="1" as="geometry"/></mxCell>`);});
  const xml=`<?xml version="1.0"?>\n<mxfile><diagram name="Arch"><mxGraphModel><root>\n<mxCell id="0"/><mxCell id="1" parent="0"/>\n${cs.join("\n")}\n</root></mxGraphModel></diagram></mxfile>`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([xml],{type:"application/xml"}));
  a.download=`${diag.title?.replace(/\s+/g,"_")||"arch"}.drawio`;a.click();
}

/* ── Edit Panel ────────────────────────────────────── */
function EditPanel({diag,setDiag,sel,setSel}:{diag:Diag;setDiag:(d:Diag)=>void;sel:Sel;setSel:(s:Sel)=>void}) {
  if(!sel) return null;
  if(sel.t==="g"){
    const g=diag.groups.find(x=>x.id===sel.id);if(!g)return null;
    const up=(u:Partial<Grp>)=>setDiag({...diag,groups:diag.groups.map(x=>x.id===g.id?{...x,...u}:x)});
    const upC=(cid:string,u:Partial<Comp>)=>up({components:g.components.map(c=>c.id===cid?{...c,...u}:c)});
    const delC=(cid:string)=>setDiag({...diag,groups:diag.groups.map(x=>x.id===g.id?{...x,components:x.components.filter(c=>c.id!==cid)}:x),flows:diag.flows.filter(f=>f.from!==cid&&f.to!==cid)});
    const addC=()=>up({components:[...g.components,{id:`n${Date.now()}`,name:"New Service"}]});
    const delG=()=>{const ids=new Set(g.components.map(c=>c.id));setDiag({...diag,groups:diag.groups.filter(x=>x.id!==g.id),flows:diag.flows.filter(f=>!ids.has(f.from)&&!ids.has(f.to))});setSel(null);};
    return (<div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:700,color:"#555"}}>✎ EDIT GROUP</span>
        <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,padding:0}}>×</button></div>
      <input value={g.name} onChange={e=>up({name:e.target.value})} style={{width:"100%",padding:"6px 8px",border:"1px solid #ddd",borderRadius:5,fontSize:12,outline:"none",boxSizing:"border-box"}}/>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{CATS.map(c=><button key={c} onClick={()=>up({category:c})} style={{width:22,height:22,borderRadius:5,background:P[c].ac,border:g.category===c?"2px solid #222":"2px solid transparent",cursor:"pointer",color:"#fff",fontSize:8}}>{g.category===c?"✓":""}</button>)}</div>
      {g.components.map(c=>(<div key={c.id} style={{padding:5,background:"#fafafa",borderRadius:5,marginBottom:3,border:"1px solid #eee"}}>
        <div style={{display:"flex",gap:4}}><input value={c.name} onChange={e=>upC(c.id,{name:e.target.value})} style={{flex:1,padding:"3px 6px",border:"1px solid #eee",borderRadius:4,fontSize:11,outline:"none"}}/>
          <button onClick={()=>delC(c.id)} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:14}}>×</button></div>
        <input value={c.subtitle||""} onChange={e=>upC(c.id,{subtitle:e.target.value})} placeholder="subtitle" style={{width:"100%",padding:"2px 6px",border:"1px solid #eee",borderRadius:4,fontSize:9,outline:"none",color:"#999",marginTop:2,boxSizing:"border-box"}}/></div>))}
      <div style={{display:"flex",gap:6}}>
        <button onClick={addC} style={{flex:1,padding:5,background:"#f0f0f0",border:"none",borderRadius:5,fontSize:10,cursor:"pointer"}}>+ Add</button>
        <button onClick={delG} style={{flex:1,padding:5,background:"#fff5f5",border:"1px solid #fecaca",borderRadius:5,fontSize:10,color:"#dc2626",cursor:"pointer"}}>Delete</button></div>
    </div>);
  }
  if(sel.t==="f"){
    const f=diag.flows[sel.idx];if(!f)return null;
    const sf=diag.security?.flows?.find(s=>s.step===f.step);
    const fN=diag.groups.flatMap(g=>g.components).find(c=>c.id===f.from)?.name||f.from;
    const tN=diag.groups.flatMap(g=>g.components).find(c=>c.id===f.to)?.name||f.to;
    const upF=(u:Partial<Flow>)=>{const nf=[...diag.flows];nf[sel.idx]={...f,...u};setDiag({...diag,flows:nf});};
    const del=()=>{setDiag({...diag,flows:diag.flows.filter((_,i)=>i!==sel.idx)});setSel(null);};
    return (<div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:700,color:"#5c6bc0"}}>STEP {f.step}</span>
        <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,padding:0}}>×</button></div>
      <div style={{padding:8,background:"#f5f5ff",borderRadius:6,fontSize:12}}><b>{fN}</b> <span style={{color:"#999"}}>→</span> <b>{tN}</b></div>
      <div><label style={{fontSize:10,color:"#999"}}>What data moves</label>
        <input value={f.label||""} onChange={e=>upF({label:e.target.value})} style={{width:"100%",padding:"5px 8px",border:"1px solid #ddd",borderRadius:5,fontSize:12,outline:"none",boxSizing:"border-box",marginTop:2}}/></div>
      <div><label style={{fontSize:10,color:"#999"}}>How (protocol / auth)</label>
        <input value={f.subtitle||""} onChange={e=>upF({subtitle:e.target.value})} style={{width:"100%",padding:"5px 8px",border:"1px solid #ddd",borderRadius:5,fontSize:11,outline:"none",boxSizing:"border-box",marginTop:2}}/></div>
      {sf&&(<div style={{padding:8,background:"#f8f9fa",borderRadius:6,fontSize:10,display:"flex",flexDirection:"column",gap:3}}>
        <div><b>Transport:</b> {sf.transport}</div><div><b>Auth:</b> {sf.auth}</div>
        <div><b>Data:</b> <span style={{color:sf.dataClassification==="regulated"?"#c62828":sf.dataClassification==="confidential"?"#e65100":"#333"}}>{sf.dataClassification}</span></div>
        <div><b>Private:</b> {sf.private?"✓ Yes":"✗ No — internet facing"}</div></div>)}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>upF({from:f.to,to:f.from})} style={{flex:1,padding:5,background:"#f5f5f5",border:"1px solid #eee",borderRadius:5,fontSize:10,cursor:"pointer"}}>⇄ Reverse</button>
        <button onClick={del} style={{flex:1,padding:5,background:"#fff5f5",border:"1px solid #fecaca",borderRadius:5,fontSize:10,color:"#dc2626",cursor:"pointer"}}>Delete</button></div>
    </div>);
  }
  if(sel.t==="th"){
    const th=diag.threats?.find(t=>t.id===sel.id);if(!th)return null;
    return (<div style={{padding:12,display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:700,color:SEV[th.severity]}}>⚠ {th.severity.toUpperCase()}</span>
        <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#bbb",cursor:"pointer",fontSize:18,padding:0}}>×</button></div>
      <div style={{fontSize:13,fontWeight:600,color:"#333"}}>{th.title}</div>
      <div style={{display:"flex",gap:4}}><span style={{padding:"2px 6px",background:"#f0f0f0",borderRadius:3,fontSize:9,fontWeight:700}}>STRIDE: {th.stride}</span>
        {th.compliance&&<span style={{padding:"2px 6px",background:"#fff3e0",borderRadius:3,fontSize:9,fontWeight:700,color:"#e65100"}}>{th.compliance}</span>}</div>
      <div style={{fontSize:11,color:"#555",lineHeight:1.5}}>{th.description}</div>
      <div style={{padding:8,background:"#fff5f5",borderRadius:6,fontSize:10}}><b>Impact:</b> {th.impact}</div>
      <div style={{padding:8,background:"#f1f8e9",borderRadius:6,fontSize:10}}><b>Fix:</b> {th.mitigation}</div>
    </div>);
  }
  return null;
}

/* ── Canvas ────────────────────────────────────────── */
function Canvas({diag,pos,setPos,sel,setSel}:{diag:Diag;pos:Record<string,GPos>;setPos:(p:Record<string,GPos>)=>void;sel:Sel;setSel:(s:Sel)=>void}) {
  const svgRef=useRef<SVGSVGElement>(null);
  const wasDrag=useRef(false), dragInfo=useRef<{gid:string;sx:number;sy:number;ox:number;oy:number}|null>(null);
  const [dragging,setDragging]=useState(false);
  const [hFlow,setHFlow]=useState<number|null>(null);
  const [animStep,setAnimStep]=useState(-1);
  const posRef=useRef(pos);posRef.current=pos;

  let mx=0,my=0; Object.values(pos).forEach(p=>{mx=Math.max(mx,p.x+p.w);my=Math.max(my,p.y+p.h)});
  const W=Math.max(mx+MG+20,600), H=Math.max(my+MG+50,400);
  const wRef=useRef(W);wRef.current=W;

  // Animation cycle
  useEffect(()=>{
    if(!diag.flows.length)return;
    const max=Math.max(...diag.flows.map(f=>f.step||0));
    const iv=setInterval(()=>setAnimStep(p=>{const n=p+1;return n>max?0:n;}),1800);
    return()=>clearInterval(iv);
  },[diag.flows]);

  // Drag
  useEffect(()=>{
    const onMove=(e:MouseEvent)=>{const d=dragInfo.current;if(!d)return;const dx=e.clientX-d.sx,dy=e.clientY-d.sy;
      if(!wasDrag.current&&Math.abs(dx)<5&&Math.abs(dy)<5)return;wasDrag.current=true;setDragging(true);
      const el=svgRef.current;if(!el)return;const r=el.getBoundingClientRect(),s=wRef.current/r.width;const c=posRef.current;
      setPos({...c,[d.gid]:{...c[d.gid],x:Math.max(10,d.ox+dx*s),y:Math.max(10,d.oy+dy*s)}});};
    const onUp=()=>{dragInfo.current=null;setDragging(false);};
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
    return()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
  },[setPos]);

  const onGDown=(gid:string,e:React.MouseEvent)=>{e.preventDefault();const p=pos[gid];if(!p)return;wasDrag.current=false;dragInfo.current={gid,sx:e.clientX,sy:e.clientY,ox:p.x,oy:p.y};};
  const onGClick=(gid:string,e:React.MouseEvent)=>{e.stopPropagation();if(wasDrag.current){wasDrag.current=false;return;}setSel({t:"g",id:gid});};
  const onFClick=(idx:number,e:React.MouseEvent)=>{e.stopPropagation();setSel({t:"f",idx});};

  const totalSteps=diag.flows.length;

  // Trust boundary rects
  const tbRects=(diag.trustBoundaries||[]).map(tb=>{
    const gps=tb.groups.map(gid=>pos[gid]).filter(Boolean);if(!gps.length)return null;
    const pad=18, x1=Math.min(...gps.map(p=>p.x))-pad, y1=Math.min(...gps.map(p=>p.y))-pad-16,
      x2=Math.max(...gps.map(p=>p.x+p.w))+pad, y2=Math.max(...gps.map(p=>p.y+p.h))+pad;
    const col=TB[tb.type]||TB.vpc;
    return{tb,x:x1,y:y1,w:x2-x1,h:y2-y1,col};
  }).filter(Boolean) as any[];

  // Threat markers
  const threatMarkers=(diag.threats||[]).map(th=>{
    if(th.locationType==="flow"){const step=parseInt(th.location);const f=diag.flows.find(fl=>fl.step===step);if(!f)return null;
      const b=flowBez(f,diag.groups,pos);if(!b)return null;return{th,x:b.lx,y:b.ly-24};}
    else{for(const g of diag.groups){const ci=g.components.findIndex(c=>c.id===th.location);
      if(ci>=0&&pos[g.id]){const cp=compXY(g,pos[g.id]);if(cp[ci])return{th,x:cp[ci].cx+IS/2+2,y:cp[ci].cy-IS/2-2};}}return null;}
  }).filter(Boolean) as {th:Threat;x:number;y:number}[];

  return (
    <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{display:"block",fontFamily:"'DM Sans',system-ui,sans-serif",cursor:dragging?"grabbing":"default"}}
      onClick={()=>{if(!wasDrag.current)setSel(null);}}>
      <defs>
        <marker id="ma" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#5c6bc0"/></marker>
        <marker id="mag" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#43a047"/></marker>
        <marker id="mao" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#ff9800"/></marker>
        <marker id="mar" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#e53935"/></marker>
        <marker id="maa" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0.5,9 3.5,0 6.5" fill="#283593"/></marker>
        <filter id="gs"><feDropShadow dx="0" dy="2" stdDeviation="5" floodOpacity=".07"/></filter>
        <filter id="gsd"><feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity=".12"/></filter>
        <filter id="is"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity=".06"/></filter>
        <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="dotG"><stop offset="0%" stopColor="#fff"/><stop offset="50%" stopColor="#5c6bc0"/><stop offset="100%" stopColor="#283593"/></radialGradient>
      </defs>
      <style>{`@keyframes flowdash{to{stroke-dashoffset:-20}}@keyframes pulseR{0%,100%{r:5;opacity:1}50%{r:7;opacity:.8}}.afl{stroke-dasharray:6 4;animation:flowdash .6s linear infinite}.afli{}.dot-pulse{animation:pulseR 1s ease-in-out infinite}`}</style>
      <rect width={W} height={H} fill="#fff"/>
      <text x={W/2} y={32} textAnchor="middle" style={{fontSize:20,fontWeight:700,fill:"#111"}}>{diag.title}</text>
      {diag.subtitle&&<text x={W/2} y={52} textAnchor="middle" style={{fontSize:11,fill:"#888",fontStyle:"italic"}}>{diag.subtitle}</text>}

      {/* Trust boundaries */}
      {tbRects.map(({tb,x,y,w,h,col}:any)=>(<g key={tb.id}>
        <rect x={x} y={y} width={w} height={h} rx={12} fill={col.f} stroke={col.s} strokeWidth={2} strokeDasharray="8 4"/>
        <text x={x+8} y={y+12} style={{fontSize:9,fontWeight:700,fill:col.l,letterSpacing:.5}}>{tb.name.toUpperCase()}</text>
      </g>))}

      {/* Flow arrows */}
      {diag.flows.map((f,fi)=>{
        const b=flowBez(f,diag.groups,pos);if(!b)return null;
        const step=f.step||fi+1;
        const sf=diag.security?.flows?.find(s=>s.step===step);
        const sc=secColor(sf);
        const isHover=hFlow===fi||(sel?.t==="f"&&sel.idx===fi);
        const isCur=animStep===step;
        const isPast=animStep===0||(animStep>0&&step<animStep);
        const active=isHover||isCur;
        const color=active?"#283593":isPast?"#43a047":sc;
        const markerMap:Record<string,string>={"#43a047":"url(#mag)","#ff9800":"url(#mao)","#e53935":"url(#mar)"};
        const marker=active?"url(#maa)":isPast?"url(#mag)":(markerMap[sc]||"url(#ma)");

        return (<g key={`f${fi}`} onMouseEnter={()=>setHFlow(fi)} onMouseLeave={()=>setHFlow(null)}
          onClick={e=>onFClick(fi,e)} style={{cursor:"pointer"}}>
          <path d={b.d} fill="none" stroke="transparent" strokeWidth={24}/>
          <path d={b.d} fill="none" className={active?"afl":"afli"}
            stroke={color} strokeWidth={active?3:isPast?2.5:2.2} markerEnd={marker}
            style={{transition:"stroke .4s,stroke-width .3s"}}/>

          {/* Step badge */}
          <circle cx={b.lx} cy={b.ly} r={14} fill={active?"#283593":isPast?"#43a047":"#5c6bc0"} style={{transition:"fill .4s"}}/>
          <text x={b.lx} y={b.ly+4.5} textAnchor="middle" style={{fontSize:11,fontWeight:800,fill:"#fff",pointerEvents:"none"}}>{step}</text>

          {/* Animated dot */}
          {isCur&&(<circle r={5} fill="url(#dotG)" filter="url(#glow)" className="dot-pulse"><animateMotion dur="1.5s" repeatCount="indefinite" path={b.d}/></circle>)}

          {/* Lock icon for secure private connections */}
          {sf?.private&&sf?.transport?.toLowerCase().includes("tls")&&(
            <g transform={`translate(${b.lx+17},${b.ly-1})`}>
              <rect x={-5} y={-3} width={10} height={8} rx={1.5} fill="#fff" stroke="#43a047" strokeWidth={1.2}/>
              <path d="M-3,-3 L-3,-6 A3,3 0 0,1 3,-6 L3,-3" fill="none" stroke="#43a047" strokeWidth={1.2}/></g>)}

          {/* WHAT label above */}
          <text x={b.lx} y={b.ly-22} textAnchor="middle"
            style={{fontSize:9,fontWeight:600,fill:active?"#283593":isPast?"#2e7d32":"#777",transition:"fill .4s",pointerEvents:"none"}}>
            {f.label||""}</text>

          {/* HOW label below */}
          {f.subtitle&&<text x={b.lx} y={b.ly+30} textAnchor="middle"
            style={{fontSize:7.5,fill:active?"#5c6bc0":"#bbb",fontStyle:"italic",transition:"fill .4s",pointerEvents:"none"}}>
            {f.subtitle}</text>}

          {/* Hover detail */}
          {isHover&&sf&&(<g>
            <rect x={b.lx-110} y={b.ly+38} width={220} height={44} rx={5} fill="#1a237e" opacity={.93}/>
            <text x={b.lx} y={b.ly+52} textAnchor="middle" style={{fontSize:9,fill:"#fff",fontWeight:600}}>{sf.transport} · {sf.auth}</text>
            <text x={b.lx} y={b.ly+64} textAnchor="middle" style={{fontSize:8,fill:sf.dataClassification==="regulated"?"#ff8a80":sf.dataClassification==="confidential"?"#ffcc80":"#c5e1a5"}}>
              {sf.dataClassification} · {sf.private?"Private":"Internet-facing"}</text>
            <text x={b.lx} y={b.ly+76} textAnchor="middle" style={{fontSize:7,fill:"#90caf9"}}>Click to edit</text></g>)}
        </g>);
      })}

      {/* Groups */}
      {diag.groups.map(g=>{
        const p=pos[g.id];if(!p)return null;
        const c=P[g.category]||P.processing;
        const isD=dragging&&dragInfo.current?.gid===g.id;
        const isS=sel?.t==="g"&&sel.id===g.id;
        const af=diag.flows.find(f=>f.step===animStep);
        const glow=af&&(g.components.some(c=>c.id===af.from)||g.components.some(c=>c.id===af.to));
        const secrets=(diag.security?.secrets||[]).filter(s=>g.components.some(c=>c.id===s.component));

        return (<g key={g.id}>
          {glow&&<rect x={p.x-4} y={p.y-4} width={p.w+8} height={p.h+8} rx={14}
            fill="none" stroke={g.components.some(c=>c.id===af?.to)?"#43a047":"#5c6bc0"} strokeWidth={2} opacity={.4} style={{filter:"url(#glow)"}}/>}
          <g onMouseDown={e=>onGDown(g.id,e)} onClick={e=>onGClick(g.id,e)} style={{cursor:isD?"grabbing":"grab"}}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={12} fill={c.bg} stroke={isS?c.ac:c.bd} strokeWidth={isS?2.5:1.2} filter={isD?"url(#gsd)":"url(#gs)"}/>
            <rect x={p.x} y={p.y} width={p.w} height={36} rx={12} fill={c.hbg}/>
            <rect x={p.x} y={p.y+26} width={p.w} height={10} fill={c.hbg}/>
            <rect x={p.x+12} y={p.y} width={p.w-24} height={3} rx={1.5} fill={c.ac}/>
            <text x={p.x+p.w/2} y={p.y+25} textAnchor="middle" style={{fontSize:12,fontWeight:700,fill:c.hc,pointerEvents:"none"}}>{g.name}</text>
          </g>
          {/* Secret key icon */}
          {secrets.length>0&&(<g transform={`translate(${p.x+p.w-16},${p.y+8})`}>
            <circle r={8} fill="#fff" stroke="#ff9800" strokeWidth={1.5}/>
            <text y={4} textAnchor="middle" style={{fontSize:9,fill:"#ff9800",pointerEvents:"none"}}>🔑</text></g>)}
          {/* Components */}
          {compXY(g,p).map(({cx,cy,comp})=>{
            const ip=iconPath(comp.name,comp.icon);
            const isCA=af&&(af.from===comp.id||af.to===comp.id);
            return (<g key={comp.id}>
              {isCA&&<circle cx={cx} cy={cy} r={28} fill="none" stroke="#5c6bc0" strokeWidth={1.5} opacity={.3}/>}
              {ip?<image href={ip} x={cx-IS/2} y={cy-IS/2} width={IS} height={IS} filter="url(#is)"/>
                :<g><rect x={cx-20} y={cy-20} width={40} height={40} rx={8} fill="#f0f0f0" stroke="#ddd" filter="url(#is)"/>
                  <text x={cx} y={cy+5} textAnchor="middle" style={{fontSize:14,fill:"#aaa"}}>?</text></g>}
              <text x={cx} y={cy+IS/2+12} textAnchor="middle" style={{fontSize:10,fontWeight:600,fill:"#333",pointerEvents:"none"}}>
                {comp.name.length>16?comp.name.slice(0,15)+"…":comp.name}</text>
              {comp.subtitle&&<text x={cx} y={cy+IS/2+23} textAnchor="middle" style={{fontSize:8,fill:"#999",pointerEvents:"none"}}>{comp.subtitle}</text>}
            </g>);
          })}
        </g>);
      })}

      {/* Threat markers */}
      {threatMarkers.map(({th,x,y})=>{
        const active=sel?.t==="th"&&sel.id===th.id;
        const col=SEV[th.severity]||SEV.medium;
        return (<g key={th.id} onClick={e=>{e.stopPropagation();setSel({t:"th",id:th.id});}} style={{cursor:"pointer"}}>
          <polygon points={`${x},${y-10} ${x-8},${y+4} ${x+8},${y+4}`} fill={active?"#fff":col} stroke={col} strokeWidth={active?2:1.5}/>
          <text x={x} y={y+1} textAnchor="middle" style={{fontSize:7,fontWeight:800,fill:active?col:"#fff",pointerEvents:"none"}}>!</text>
          <text x={x+10} y={y} style={{fontSize:7,fill:col,fontWeight:700,pointerEvents:"none"}}>{th.stride}</text>
        </g>);
      })}

      {/* Progress bar */}
      <g transform={`translate(${MG},${H-32})`}>
        {diag.flows.map((f,fi)=>{const step=f.step||fi+1;const isCur=animStep===step;const isPast=animStep===0||(animStep>0&&step<animStep);const w=(W-2*MG)/totalSteps;
          return (<g key={fi} transform={`translate(${fi*w},0)`}>
            <rect x={0} y={0} width={w-4} height={20} rx={4}
              fill={isCur?"#283593":isPast?"#e8f5e9":"#f5f5f5"} stroke={isCur?"#283593":isPast?"#a5d6a7":"#eee"} strokeWidth={1} style={{transition:"fill .4s"}}/>
            <text x={(w-4)/2} y={13} textAnchor="middle" style={{fontSize:7.5,fontWeight:600,fill:isCur?"#fff":isPast?"#2e7d32":"#bbb",pointerEvents:"none"}}>
              {step}. {(f.label||"").slice(0,16)}</text></g>);})}
      </g>
    </svg>
  );
}

/* ── Dashboard ─────────────────────────────────────── */
export default function Dashboard({user}:{user:User}) {
  const {logout,isLoggingOut}=useAuth();
  const [prompt,setPrompt]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [diag,setDiag]=useState<Diag|null>(null);
  const [pos,setPos]=useState<Record<string,GPos>>({});
  const [sel,setSel]=useState<Sel>(null);

  useEffect(()=>{loadIcons()},[]);

  const updateDiag=useCallback((d:Diag)=>{
    setDiag(d);const np={...pos};
    d.groups.forEach(g=>{const s=gSz(g);if(np[g.id])np[g.id]={...np[g.id],w:s.w,h:s.h};else{const a=doLayout(d.groups,d.flows);if(a[g.id])np[g.id]=a[g.id];}});
    Object.keys(np).forEach(k=>{if(!d.groups.find(g=>g.id===k))delete np[k]});setPos(np);
  },[pos]);

  const generate=useCallback(async()=>{
    if(!prompt.trim())return;setLoading(true);setError("");setDiag(null);setSel(null);
    try{const res=await fetch("/api/diagrams/generate",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({prompt})});
      if(!res.ok)throw new Error((await res.json()).error||"Failed");
      const d=(await res.json()).diagram as Diag;setDiag(d);setPos(doLayout(d.groups,d.flows));
    }catch(e:any){setError(e.message)} setLoading(false);
  },[prompt]);

  const reset=()=>{if(diag){setPos(doLayout(diag.groups,diag.flows));setSel(null)}};
  const threats=diag?.threats||[];
  const sortedThreats=[...threats].sort((a,b)=>{const o:Record<string,number>={critical:0,high:1,medium:2,low:3};return(o[a.severity]??4)-(o[b.severity]??4);});

  return (
    <div style={{minHeight:"100vh",background:"#fff",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.fade-up{animation:fadeUp .3s ease-out}textarea:focus{border-color:#333!important;background:#fff!important}`}</style>

      {/* Header */}
      <div style={{height:52,padding:"0 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:"#212529",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:12}}>◇</div>
          <span style={{fontSize:14,fontWeight:700}}>ArchGen</span>
          <span style={{fontSize:9,background:"#f5f5f5",color:"#999",padding:"2px 6px",borderRadius:3,fontWeight:600}}>BETA</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {diag&&<><button onClick={reset} style={{background:"none",border:"1px solid #eee",padding:"4px 10px",borderRadius:6,fontSize:11,color:"#999",cursor:"pointer"}}>⟲ Reset</button>
            <button onClick={()=>doExport(diag,pos)} style={{background:"#212529",color:"#fff",border:"none",padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:600,cursor:"pointer"}}>↓ .drawio</button></>}
          <span style={{fontSize:12,color:"#aaa"}}>{user.firstName||user.email}</span>
          <button onClick={()=>logout()} disabled={isLoggingOut} style={{background:"none",border:"1px solid #eee",padding:"4px 10px",borderRadius:6,fontSize:11,color:"#999",cursor:"pointer"}}>Logout</button></div>
      </div>

      <div style={{display:"flex",height:"calc(100vh - 52px)"}}>
        {/* Sidebar */}
        <div style={{width:300,borderRight:"1px solid #f0f0f0",padding:14,display:"flex",flexDirection:"column",gap:10,overflowY:"auto",flexShrink:0}}>
          <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))generate()}}
            placeholder="Describe your data pipeline or AI system..."
            style={{width:"100%",minHeight:90,padding:10,border:"1px solid #eee",borderRadius:8,fontSize:12,color:"#333",outline:"none",resize:"vertical",lineHeight:1.6,background:"#fafafa",boxSizing:"border-box"}}/>
          <button onClick={generate} disabled={loading||!prompt.trim()}
            style={{width:"100%",padding:"9px 0",background:loading?"#666":"#212529",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,
              cursor:loading?"wait":"pointer",opacity:!prompt.trim()?.3:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading&&<div style={{width:14,height:14,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}
            {loading?"Generating...":"Generate Architecture"}</button>
          {error&&<div style={{padding:8,borderRadius:6,background:"#fff5f5",border:"1px solid #fecaca",color:"#dc2626",fontSize:11}}>{error}</div>}

          {diag&&sel?(
            <EditPanel diag={diag} setDiag={updateDiag} sel={sel} setSel={setSel}/>
          ):diag?(
            <>
              {/* Data journey */}
              <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:1}}>DATA JOURNEY</div>
              {diag.flows.map((f,i)=>(<div key={i} onClick={()=>setSel({t:"f",idx:i})}
                style={{padding:"5px 8px",background:sel?.t==="f"&&(sel as any).idx===i?"#f0f0ff":"#fafafa",border:"1px solid #f0f0f0",borderRadius:6,cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,fontWeight:700,color:"#5c6bc0",minWidth:32}}>Step {f.step}</span>
                  <span style={{fontSize:10,fontWeight:600,color:"#333"}}>{f.label}</span></div>
                {f.subtitle&&<div style={{fontSize:8,color:"#999",marginTop:1,marginLeft:38}}>{f.subtitle}</div>}
              </div>))}

              {/* Threats */}
              {sortedThreats.length>0&&<>
                <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:1,marginTop:6}}>THREATS</div>
                {sortedThreats.map(t=>(<button key={t.id} onClick={()=>setSel({t:"th",id:t.id})}
                  style={{width:"100%",textAlign:"left",padding:"5px 8px",marginBottom:2,borderRadius:5,cursor:"pointer",
                    background:sel?.t==="th"&&sel.id===t.id?"#fff5f5":"#fafafa",border:sel?.t==="th"&&sel.id===t.id?`1px solid ${SEV[t.severity]}`:"1px solid #f0f0f0",display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:2,background:SEV[t.severity],flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:600,color:"#333",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</div>
                    <div style={{fontSize:8,color:"#999"}}>{t.stride} · {t.locationType==="flow"?`Step ${t.location}`:t.location}</div></div>
                </button>))}
              </>}

              {/* Stats */}
              <div style={{padding:10,background:"#f8f9fa",borderRadius:6,border:"1px solid #f0f0f0",marginTop:"auto"}}>
                <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                  {[{n:diag.groups.length,l:"Groups"},{n:diag.flows.length,l:"Steps"},{n:threats.length,l:"Threats"},{n:diag.trustBoundaries?.length||0,l:"Zones"}].map((s,i)=>(
                    <div key={i}><div style={{fontSize:14,fontWeight:700,color:"#212529"}}>{s.n}</div><div style={{fontSize:8,color:"#aaa"}}>{s.l}</div></div>))}
                </div></div>
            </>
          ):(
            <><div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:1,marginTop:4}}>TEMPLATES</div>
              {SAMPLES.map((s,i)=>(<button key={i} onClick={()=>setPrompt(s.prompt)} style={{width:"100%",textAlign:"left",padding:"8px 10px",background:"#fafafa",border:"1px solid #f0f0f0",borderRadius:6,cursor:"pointer"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#333"}}>{s.label}</div>
                <div style={{fontSize:9,color:"#aaa",marginTop:2}}>{s.prompt.slice(0,70)}...</div></button>))}</>
          )}
        </div>

        {/* Canvas */}
        <div style={{flex:1,overflow:"auto",padding:20,background:"#fafafa"}}>
          {!diag&&!loading&&(<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10}}>
            <div style={{fontSize:48,color:"#e0e0e0"}}>◇</div><div style={{color:"#bbb",fontSize:13}}>Describe a system to generate its architecture</div></div>)}
          {loading&&(<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
            <div style={{width:28,height:28,border:"3px solid #e5e5e5",borderTopColor:"#212529",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>
            <div style={{color:"#999",fontSize:13}}>Generating architecture story...</div></div>)}
          {diag&&Object.keys(pos).length>0&&(
            <div className="fade-up" style={{background:"#fff",borderRadius:12,border:"1px solid #e5e5e5",display:"inline-block",boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
              <Canvas diag={diag} pos={pos} setPos={setPos} sel={sel} setSel={setSel}/>
            </div>)}
        </div>
      </div>
    </div>
  );
}
