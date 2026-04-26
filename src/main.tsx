import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, Archive, Camera, CheckCircle2, Crosshair, Download, Eye, FileText,
  Grid3X3, Map, Package, Plus, Radio, Save, Search, ShieldCheck, Wrench, Zap
} from 'lucide-react';
import './style.css';
import type { AsBuiltPoint, ConstantData, ModuleType, QCRecord, GPSPoint } from './types';
import {
  DEFAULT_CONSTANTS, downloadText, loadAsBuilt, loadConstants, loadRecords,
  makeCsv, now12, saveAsBuilt, saveConstants, saveRecords
} from './storage';

const MODULES: { id: ModuleType; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'roll', label: 'Roll Inventory', icon: <Package size={18} />, desc: 'Roll number, width, type, certs' },
  { id: 'panel', label: 'Panel Placement', icon: <Grid3X3 size={18} />, desc: 'Panel, roll, location, deployment' },
  { id: 'seam', label: 'Seam Log', icon: <Zap size={18} />, desc: 'Seam number, panels, welder, footage' },
  { id: 'wedge', label: 'Wedge Test', icon: <Activity size={18} />, desc: 'Temp, speed, peel, shear' },
  { id: 'extrusion', label: 'Extrusion Log', icon: <Wrench size={18} />, desc: 'Extruder, rod lot, patch/bead' },
  { id: 'air', label: 'Air Test', icon: <Radio size={18} />, desc: 'Start/end PSI and hold' },
  { id: 'dt', label: 'Destructive Test', icon: <ShieldCheck size={18} />, desc: 'DT ID, seam, station' },
  { id: 'repair', label: 'Repair Log', icon: <Wrench size={18} />, desc: 'Patch, bead, cap, vacuum' },
  { id: 'daily', label: 'Daily Log', icon: <FileText size={18} />, desc: 'Crew, weather, production' }
];

const FIELD_MAP: Record<ModuleType, [string, string][]> = {
  roll: [['Roll Number','rollNumber'], ['Lot Number','lotNumber'], ['Manufacturer','manufacturer'], ['Cert Status','certStatus']],
  panel: [['Panel Number','panelNumber'], ['Roll Number','rollNumber'], ['Panel Size','panelSize'], ['Direction / Area','direction']],
  seam: [['Seam Number','seamNumber'], ['Panel A','panelA'], ['Panel B','panelB'], ['Welder','welder'], ['Weld Type','weldType'], ['Length / Station','lengthStation']],
  wedge: [['Seam Number','seamNumber'], ['Machine','machine'], ['Temperature','temperature'], ['Speed','speed'], ['Peel Result','peel'], ['Shear Result','shear']],
  extrusion: [['Repair / Seam','repairSeam'], ['Extruder','extruder'], ['Rod Lot','rodLot'], ['Preheat / Prep','prep'], ['Result','result']],
  air: [['Seam Number','seamNumber'], ['Start PSI','startPsi'], ['End PSI','endPsi'], ['Hold Minutes','holdMinutes'], ['Result','result']],
  dt: [['DT Number','dtNumber'], ['Seam Number','seamNumber'], ['Station / Footage','station'], ['Lab Number','labNumber'], ['Result','result']],
  repair: [['Repair ID','repairId'], ['Repair Type','repairType'], ['Related Seam','relatedSeam'], ['Size','size'], ['Verified By','verifiedBy']],
  daily: [['Crew','crew'], ['Weather','weather'], ['Production','production'], ['Delays / Issues','issues']]
};

function getGps(): Promise<GPSPoint | undefined> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, capturedAt: now12() }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function constantTitle(c: ConstantData) {
  return [c.activeRollNumber && `Roll ${c.activeRollNumber}`, c.activePanel, c.activeSeam, c.linerWidth, c.linerThickness, c.linerType]
    .filter(Boolean).join(' • ') || 'No constants saved';
}

function App() {
  const [tab, setTab] = useState<'dashboard'|'capture'|'logs'|'asbuilt'|'vision'|'exports'>('dashboard');
  const [constants, setConstants] = useState<ConstantData>(() => loadConstants());
  const [records, setRecords] = useState<QCRecord[]>(() => loadRecords());
  const [points, setPoints] = useState<AsBuiltPoint[]>(() => loadAsBuilt());
  const [activeType, setActiveType] = useState<ModuleType>('seam');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<GPSPoint | undefined>(undefined);
  const [query, setQuery] = useState('');

  useEffect(() => saveConstants(constants), [constants]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveAsBuilt(points), [points]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [, key] of FIELD_MAP[activeType]) {
      if (key === 'rollNumber') next[key] = constants.activeRollNumber;
      if (key === 'panelNumber' || key === 'panelA') next[key] = constants.activePanel;
      if (key === 'seamNumber' || key === 'relatedSeam') next[key] = constants.activeSeam;
      if (key === 'machine') next[key] = constants.wedgeMachine;
      if (key === 'extruder') next[key] = constants.extrusionWelder;
      if (key === 'rodLot') next[key] = constants.rodLot;
      if (key === 'panelSize') next[key] = [constants.linerWidth, constants.linerThickness, constants.linerType].filter(Boolean).join(' / ');
      if (key === 'crew') next[key] = constants.crew || constants.installer;
      if (key === 'weather') next[key] = constants.weather;
    }
    setFields(next);
    setLocation(constants.activePanel || constants.activeSeam || '');
  }, [activeType, constants]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return records.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [records, query]);

  async function captureGps() {
    const p = await getGps();
    setGps(p);
  }

  async function saveRecord(lock = false) {
    const capturedGps = gps || await getGps();
    const moduleLabel = MODULES.find(m => m.id === activeType)?.label || activeType;
    const rec: QCRecord = {
      id: `LS-${Date.now()}`,
      type: activeType,
      title: `${moduleLabel} - ${fields.seamNumber || fields.panelNumber || fields.rollNumber || constants.activeSeam || constants.activePanel || constants.activeRollNumber || now12()}`,
      location,
      status: lock ? 'locked' : 'draft',
      constants: { ...constants },
      fields: { ...fields },
      gps: capturedGps,
      createdAt: new Date().toISOString(),
      createdAtDisplay: now12(),
      notes
    };
    setRecords([rec, ...records]);
    const kind = activeType === 'seam' ? 'seam' : activeType === 'panel' ? 'panel' : activeType === 'repair' ? 'repair' : activeType === 'dt' ? 'dt' : 'photo';
    setPoints([{ id: `P-${Date.now()}`, kind, label: rec.title, x: 12 + Math.random()*76, y: 12 + Math.random()*70, recordId: rec.id, color: kind === 'seam' ? '#38bdf8' : kind === 'repair' ? '#f59e0b' : kind === 'dt' ? '#ef4444' : '#22c55e' }, ...points]);
    setNotes('');
    setGps(undefined);
    setTab('logs');
  }

  function updateConst<K extends keyof ConstantData>(key: K, value: ConstantData[K]) {
    setConstants({ ...constants, [key]: value });
  }

  function exportBackup() {
    downloadText('LinerSync_FIELD_backup.json', JSON.stringify({ constants, records, points, exportedAt: now12() }, null, 2), 'application/json');
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>FIELD BUILD • REACT</p></div></div>
      <Nav tab={tab} setTab={setTab} />
      <div className="side-card"><div className="tiny">ACTIVE CONSTANTS</div><strong>{constantTitle(constants)}</strong></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><div className="tiny">Current Repo</div><strong>LINERSYNC-FIELD</strong></div>
        <div className="gps-pill"><Crosshair size={14}/>{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : 'GPS ready'}</div>
      </header>
      {tab === 'dashboard' && <Dashboard constants={constants} records={records} setTab={setTab} />}
      {tab === 'capture' && <Capture activeType={activeType} setActiveType={setActiveType} constants={constants} updateConst={updateConst} fields={fields} setFields={setFields} location={location} setLocation={setLocation} notes={notes} setNotes={setNotes} gps={gps} captureGps={captureGps} saveRecord={saveRecord} />}
      {tab === 'logs' && <Logs records={filtered} query={query} setQuery={setQuery} />}
      {tab === 'asbuilt' && <AsBuilt points={points} />}
      {tab === 'vision' && <Vision constants={constants} gps={gps} captureGps={captureGps} points={points} />}
      {tab === 'exports' && <Exports records={records} exportBackup={exportBackup} exportCsv={() => downloadText('LinerSync_FIELD_export.csv', makeCsv(records), 'text/csv')} />}
    </main>
  </div>;
}

function Nav({ tab, setTab }: { tab: string; setTab: (t: any)=>void }) {
  const items = [
    ['dashboard', <Activity size={18}/>, 'Dashboard'], ['capture', <Plus size={18}/>, 'Tap Capture'], ['logs', <Archive size={18}/>, 'Last Logs'],
    ['asbuilt', <Map size={18}/>, 'As-Built'], ['vision', <Eye size={18}/>, 'AR Vision'], ['exports', <Download size={18}/>, 'Export']
  ] as const;
  return <nav>{items.map(([id, icon, label]) => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>)}</nav>;
}

function Dashboard({ constants, records, setTab }: { constants: ConstantData; records: QCRecord[]; setTab:(t:any)=>void }) {
  const locked = records.filter(r => r.status === 'locked').length;
  const seams = records.filter(r => r.type === 'seam').length;
  return <section className="page"><h2>Field Dashboard</h2><p className="muted">This is the real repo build. Seam Log, As-Built, AR Vision, AutoFill Constants, Last Logs, GPS/time, and export are active.</p>
    <div className="kpis"><Kpi label="Total Logs" value={records.length}/><Kpi label="Seam Logs" value={seams}/><Kpi label="Locked" value={locked}/></div>
    <div className="card"><h3>AutoFill Constants</h3><p>{constantTitle(constants)}</p><button onClick={()=>setTab('capture')}>Open Tap Capture</button></div>
  </section>;
}
function Kpi({label,value}:{label:string;value:number}){return <div className="kpi"><strong>{value}</strong><span>{label}</span></div>}

function Capture(props: any) {
  const { activeType,setActiveType,constants,updateConst,fields,setFields,location,setLocation,notes,setNotes,gps,captureGps,saveRecord } = props;
  return <section className="page"><h2>Tap Capture</h2><p className="muted">Constants stay filled until changed. Change roll/seam/panel once, then every log inherits it.</p>
    <div className="card"><h3>Constant Job Data</h3><div className="form-grid">
      {([
        ['projectName','Project'],['client','Client'],['qcTech','QC Tech'],['installer','Installer'],['crew','Crew'],['activeRollNumber','Active Roll #'],['activePanel','Active Panel / Area'],['activeSeam','Active Seam'],['linerType','Liner Type'],['linerThickness','Thickness'],['linerWidth','Width'],['textureColor','Texture / Color'],['wedgeMachine','Wedge Machine'],['extrusionWelder','Extrusion Welder'],['rodLot','Rod / Resin Lot'],['weather','Weather'],['shift','Shift']
      ] as [keyof ConstantData,string][]).map(([k,l]) => <label key={k}>{l}<input value={constants[k]} onChange={e=>updateConst(k,e.target.value)} /></label>)}
    </div></div>
    <div className="card"><h3>New Log</h3><label>Module<select value={activeType} onChange={e=>setActiveType(e.target.value)}>{MODULES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <div className="module-strip">{MODULES.map(m=><button key={m.id} className={activeType===m.id?'selected':''} onClick={()=>setActiveType(m.id)}>{m.icon}<span>{m.label}</span></button>)}</div>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Seam, panel, pond, station..." /></label>
      <div className="form-grid">{FIELD_MAP[activeType].map(([label,key])=><label key={key}>{label}<input value={fields[key]||''} onChange={e=>setFields({...fields,[key]:e.target.value})}/></label>)}</div>
      <label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <div className="button-row"><button onClick={captureGps}><Camera size={16}/> Capture GPS/Time</button><button onClick={()=>saveRecord(false)}><Save size={16}/> Save Draft</button><button className="green" onClick={()=>saveRecord(true)}><CheckCircle2 size={16}/> Approve / Lock</button></div>
      <p className="muted">{gps ? `GPS captured ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} ±${Math.round(gps.accuracy||0)}m at ${gps.capturedAt}` : 'GPS not captured yet.'}</p>
    </div></section>;
}

function Logs({records,query,setQuery}:{records:QCRecord[];query:string;setQuery:(v:string)=>void}){
  return <section className="page"><h2>Last Logs</h2><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search seam, roll, panel, repair..." /></label>
    <div className="log-list">{records.map(r=><article className="log" key={r.id}><div><strong>{r.title}</strong><p>{r.createdAtDisplay} • {r.status.toUpperCase()} • {r.location}</p><p>Roll {r.constants.activeRollNumber || '-'} • Panel {r.constants.activePanel || '-'} • Seam {r.constants.activeSeam || '-'}</p><p>{Object.entries(r.fields).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' • ')}</p></div></article>)}</div>
  </section>;
}

function AsBuilt({points}:{points:AsBuiltPoint[]}){
  return <section className="page"><h2>As-Built Map</h2><p className="muted">Prototype site canvas. Every saved panel/seam/repair/DT drops a point here for the daily as-built.</p><div className="mapbox">{points.map(p=><div key={p.id} className="pin" style={{left:`${p.x}%`,top:`${p.y}%`,background:p.color}} title={p.label}>{p.kind[0].toUpperCase()}</div>)}<div className="north">N</div></div></section>;
}

function Vision({constants,gps,captureGps,points}:{constants:ConstantData;gps?:GPSPoint;captureGps:()=>void;points:AsBuiltPoint[]}){
  const target = points[0];
  return <section className="page"><h2>AR Vision HUD</h2><p className="muted">Camera/AR workflow shell: shows active seam, roll, GPS, and nearest as-built target. This is where live camera overlay logic connects next.</p><div className="vision"><div className="reticle"></div><div className="hud top-left">ROLL {constants.activeRollNumber || '--'}<br/>SEAM {constants.activeSeam || '--'}<br/>PANEL {constants.activePanel || '--'}</div><div className="hud bottom-left">{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : 'NO GPS LOCK'}</div><div className="hud top-right">TARGET<br/>{target?.label || 'No as-built point'}</div></div><button onClick={captureGps}><Crosshair size={16}/> Capture Current Position</button></section>;
}

function Exports({records,exportBackup,exportCsv}:{records:QCRecord[];exportBackup:()=>void;exportCsv:()=>void}){
  return <section className="page"><h2>Export</h2><div className="card"><p>{records.length} records ready.</p><div className="button-row"><button onClick={exportCsv}><Download size={16}/> CSV Export</button><button onClick={exportBackup}><Download size={16}/> JSON Backup</button></div></div></section>;
}

createRoot(document.getElementById('root')!).render(<App />);
