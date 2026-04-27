import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, Archive, Brain, Camera, CheckCircle2, Copy, Crosshair, Download, Eye, FileText,
  Grid3X3, Map, Package, Plus, Radio, Save, Search, ShieldCheck, Trash2, Wrench, Zap
} from 'lucide-react';
import './style.css';
import type { AsBuiltPoint, ConstantData, ModuleType, QCRecord, GPSPoint } from './types';
import {
  downloadText, loadAsBuilt, loadConstants, loadRecords,
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

type AppTab = 'dashboard'|'capture'|'logs'|'asbuilt'|'vision'|'mythos'|'exports';
type MythosIssue = { level: 'danger'|'warning'|'ok'; title: string; detail: string; action: string };
type AsBuiltKind = AsBuiltPoint['kind'];

type EditState = {
  id: string;
  originalCreatedAt: string;
  originalCreatedAtDisplay: string;
} | null;

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

function colorForKind(kind: AsBuiltKind) {
  if (kind === 'seam') return '#38bdf8';
  if (kind === 'repair') return '#f59e0b';
  if (kind === 'dt') return '#ef4444';
  if (kind === 'photo') return '#a78bfa';
  return '#22c55e';
}

function moduleLabel(type: ModuleType) {
  return MODULES.find(m => m.id === type)?.label || type;
}

function recordTitle(type: ModuleType, fields: Record<string, string>, constants: ConstantData) {
  return `${moduleLabel(type)} - ${fields.seamNumber || fields.panelNumber || fields.rollNumber || constants.activeSeam || constants.activePanel || constants.activeRollNumber || now12()}`;
}

function analyzeMythos(constants: ConstantData, records: QCRecord[]): MythosIssue[] {
  const issues: MythosIssue[] = [];
  const requiredConstants: [keyof ConstantData, string][] = [
    ['projectName','Project name'], ['qcTech','QC tech'], ['activeRollNumber','Active roll number'], ['activePanel','Active panel/area'],
    ['linerType','Liner type'], ['linerThickness','Liner thickness'], ['linerWidth','Liner width'], ['installer','Installer'], ['weather','Weather']
  ];

  for (const [key, label] of requiredConstants) {
    if (!String(constants[key] || '').trim()) {
      issues.push({ level: 'warning', title: `${label} is missing`, detail: `Mythos cannot auto-fill clean logs without ${label.toLowerCase()}.`, action: `Open Tap Capture and fill ${label}.` });
    }
  }

  const todays = records.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString());
  const seamLogs = records.filter(r => r.type === 'seam');
  const airLogs = records.filter(r => r.type === 'air');
  const dtLogs = records.filter(r => r.type === 'dt');
  const repairLogs = records.filter(r => r.type === 'repair');
  const missingGps = records.filter(r => !r.gps);
  const drafts = records.filter(r => r.status !== 'locked');

  if (records.length === 0) issues.push({ level: 'danger', title: 'No field logs saved yet', detail: 'The app has no real job data for Mythos to learn from.', action: 'Start with a Seam Log or Panel Placement and lock the first record.' });
  if (seamLogs.length > 0 && dtLogs.length === 0) issues.push({ level: 'warning', title: 'Seams exist but no DT logged', detail: `${seamLogs.length} seam log(s) are saved with zero destructive tests.`, action: 'Add a Destructive Test or mark why DT is not required yet.' });

  const shortAir = airLogs.filter(r => Number(r.fields.holdMinutes || 0) > 0 && Number(r.fields.holdMinutes || 0) < 5);
  if (shortAir.length) issues.push({ level: 'danger', title: 'Air test hold time problem', detail: `${shortAir.length} air test(s) show hold time under 5 minutes.`, action: 'Open Last Logs, find the air test, and correct or re-test before approval.' });
  if (missingGps.length) issues.push({ level: 'warning', title: 'Some logs are missing GPS', detail: `${missingGps.length} record(s) saved without GPS coordinates.`, action: 'Use Capture GPS/Time before locking important QC records.' });
  if (drafts.length) issues.push({ level: 'warning', title: 'Draft records not locked', detail: `${drafts.length} record(s) are still drafts.`, action: 'Review them in Last Logs and approve/lock the ones that are correct.' });
  if (repairLogs.length && !records.some(r => r.type === 'air' || r.type === 'extrusion')) issues.push({ level: 'warning', title: 'Repairs logged without test support', detail: 'Repairs exist, but no air/extrusion support logs are saved.', action: 'Add extrusion/vacuum/air verification depending on the repair type.' });
  if (todays.length === 0 && records.length > 0) issues.push({ level: 'warning', title: 'No logs for today', detail: 'The app has old logs but nothing saved today.', action: 'Start today with a Daily Log or first Seam Log.' });
  if (!issues.length) issues.push({ level: 'ok', title: 'QC data looks clean', detail: 'Mythos does not see missing constants, failed air holds, missing GPS, or unlocked drafts right now.', action: 'Keep logging seams, tests, repairs, and daily notes.' });

  return issues;
}

function nextMythosAction(constants: ConstantData, records: QCRecord[]) {
  if (!constants.projectName) return 'Fill Project Name in Constant Job Data.';
  if (!constants.activeRollNumber) return 'Set the active roll number before logging more panels or seams.';
  if (!constants.activeSeam) return 'Set the active seam, then capture a Seam Log.';
  if (!records.some(r => r.type === 'seam')) return 'Capture your first Seam Log.';
  if (records.some(r => r.type === 'seam') && !records.some(r => r.type === 'dt')) return 'Add the next Destructive Test for the active seam.';
  if (records.some(r => r.status === 'draft')) return 'Review and lock draft records in Last Logs.';
  return 'Capture the next field item: seam, test, repair, or daily note.';
}

function App() {
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [constants, setConstants] = useState<ConstantData>(() => loadConstants());
  const [records, setRecords] = useState<QCRecord[]>(() => loadRecords());
  const [points, setPoints] = useState<AsBuiltPoint[]>(() => loadAsBuilt());
  const [activeType, setActiveType] = useState<ModuleType>('seam');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [gps, setGps] = useState<GPSPoint | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [editState, setEditState] = useState<EditState>(null);

  useEffect(() => saveConstants(constants), [constants]);
  useEffect(() => saveRecords(records), [records]);
  useEffect(() => saveAsBuilt(points), [points]);

  useEffect(() => {
    if (editState) return;
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
  }, [activeType, constants, editState]);

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
    const rec: QCRecord = {
      id: editState?.id || `LS-${Date.now()}`,
      type: activeType,
      title: recordTitle(activeType, fields, constants),
      location,
      status: lock ? 'locked' : 'draft',
      constants: { ...constants },
      fields: { ...fields },
      gps: capturedGps,
      createdAt: editState?.originalCreatedAt || new Date().toISOString(),
      createdAtDisplay: editState ? `${editState.originalCreatedAtDisplay} • EDITED ${now12()}` : now12(),
      notes
    };

    if (editState) {
      setRecords(records.map(r => r.id === editState.id ? rec : r));
      setEditState(null);
    } else {
      setRecords([rec, ...records]);
      const kind: AsBuiltKind = activeType === 'seam' ? 'seam' : activeType === 'panel' ? 'panel' : activeType === 'repair' ? 'repair' : activeType === 'dt' ? 'dt' : 'photo';
      setPoints([{ id: `P-${Date.now()}`, kind, label: rec.title, x: 12 + Math.random()*76, y: 12 + Math.random()*70, recordId: rec.id, color: colorForKind(kind) }, ...points]);
    }
    setNotes('');
    setGps(undefined);
    setTab('logs');
  }

  function startEdit(r: QCRecord) {
    setEditState({ id: r.id, originalCreatedAt: r.createdAt, originalCreatedAtDisplay: r.createdAtDisplay });
    setActiveType(r.type);
    setFields({ ...r.fields });
    setLocation(r.location || '');
    setNotes(r.notes || '');
    setGps(r.gps);
    setConstants({ ...constants, ...r.constants });
    setTab('capture');
  }

  function cancelEdit() {
    setEditState(null);
    setFields({});
    setNotes('');
    setGps(undefined);
  }

  function updateConst<K extends keyof ConstantData>(key: K, value: ConstantData[K]) {
    setConstants({ ...constants, [key]: value });
  }

  function exportBackup() {
    downloadText('LinerSync_FIELD_backup.json', JSON.stringify({ constants, records, points, exportedAt: now12() }, null, 2), 'application/json');
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">LS</div><div><h1>LINERSYNC</h1><p>FIELD BUILD • CHUNK 5</p></div></div>
      <Nav tab={tab} setTab={setTab} />
      <div className="side-card"><div className="tiny">MYTHOS NEXT</div><strong>{nextMythosAction(constants, records)}</strong></div>
      <div className="side-card"><div className="tiny">ACTIVE CONSTANTS</div><strong>{constantTitle(constants)}</strong></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><div className="tiny">Current Repo</div><strong>LINERSYNC-FIELD • Last Logs Edit Build</strong></div>
        <div className="gps-pill"><Crosshair size={14}/>{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : 'GPS ready'}</div>
      </header>
      {tab === 'dashboard' && <Dashboard constants={constants} records={records} points={points} setTab={setTab} />}
      {tab === 'capture' && <Capture editState={editState} activeType={activeType} setActiveType={setActiveType} constants={constants} updateConst={updateConst} fields={fields} setFields={setFields} location={location} setLocation={setLocation} notes={notes} setNotes={setNotes} gps={gps} captureGps={captureGps} saveRecord={saveRecord} cancelEdit={cancelEdit} />}
      {tab === 'logs' && <Logs records={filtered} allRecords={records} setRecords={setRecords} query={query} setQuery={setQuery} startEdit={startEdit} />}
      {tab === 'asbuilt' && <AsBuilt points={points} setPoints={setPoints} constants={constants} />}
      {tab === 'vision' && <Vision constants={constants} gps={gps} captureGps={captureGps} points={points} />}
      {tab === 'mythos' && <Mythos constants={constants} records={records} points={points} setTab={setTab} />}
      {tab === 'exports' && <Exports records={records} points={points} exportBackup={exportBackup} exportCsv={() => downloadText('LinerSync_FIELD_export.csv', makeCsv(records), 'text/csv')} />}
    </main>
  </div>;
}

function Nav({ tab, setTab }: { tab: string; setTab: (t: any)=>void }) {
  const items = [
    ['dashboard', <Activity size={18}/>, 'Dashboard'], ['capture', <Plus size={18}/>, 'Tap Capture'], ['logs', <Archive size={18}/>, 'Last Logs'],
    ['asbuilt', <Map size={18}/>, 'As-Built'], ['vision', <Eye size={18}/>, 'AR Vision'], ['mythos', <Brain size={18}/>, 'Mythos'], ['exports', <Download size={18}/>, 'Export']
  ] as const;
  return <nav>{items.map(([id, icon, label]) => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{icon}<span>{label}</span></button>)}</nav>;
}

function Dashboard({ constants, records, points, setTab }: { constants: ConstantData; records: QCRecord[]; points: AsBuiltPoint[]; setTab:(t:any)=>void }) {
  const locked = records.filter(r => r.status === 'locked').length;
  const seams = records.filter(r => r.type === 'seam').length;
  const drafts = records.filter(r => r.status === 'draft').length;
  return <section className="page"><h2>Field Dashboard</h2><p className="muted">Seam Log, AutoFill, Mythos, As-Built, AR Vision, GPS/time, Last Logs, edit, lock, duplicate, delete, and export are active.</p>
    <div className="kpis"><Kpi label="Total Logs" value={records.length}/><Kpi label="Seam Logs" value={seams}/><Kpi label="As-Built Points" value={points.length}/><Kpi label="Drafts" value={drafts}/></div>
    <div className="card"><h3>Chunk 5 Last Logs</h3><p>Open Last Logs to review saved data, edit bad entries, lock good records, copy repeat entries, or export one record.</p><div className="button-row"><button onClick={()=>setTab('logs')}><Archive size={16}/> Open Last Logs</button><button onClick={()=>setTab('capture')}><Plus size={16}/> Open Tap Capture</button><button onClick={()=>setTab('asbuilt')}><Map size={16}/> Open As-Built</button></div></div>
    <div className="card"><h3>AutoFill Constants</h3><p>{constantTitle(constants)}</p><p className="muted">Locked records: {locked}</p></div>
  </section>;
}
function Kpi({label,value}:{label:string;value:number}){return <div className="kpi"><strong>{value}</strong><span>{label}</span></div>}

function Capture(props: any) {
  const { editState, activeType,setActiveType,constants,updateConst,fields,setFields,location,setLocation,notes,setNotes,gps,captureGps,saveRecord,cancelEdit } = props;
  return <section className="page"><h2>{editState ? 'Edit Saved Log' : 'Tap Capture'}</h2><p className="muted">Constants stay filled until changed. Edit keeps the same saved record ID and updates the existing log instead of creating junk duplicates.</p>
    {editState && <div className="card"><h3>Editing Record {editState.id}</h3><p className="muted">Make the correction, then Save Draft or Approve / Lock.</p><button onClick={cancelEdit}>Cancel Edit</button></div>}
    <div className="card"><h3>Constant Job Data</h3><div className="form-grid">
      {([
        ['projectName','Project'],['client','Client'],['qcTech','QC Tech'],['installer','Installer'],['crew','Crew'],['activeRollNumber','Active Roll #'],['activePanel','Active Panel / Area'],['activeSeam','Active Seam'],['linerType','Liner Type'],['linerThickness','Thickness'],['linerWidth','Width'],['textureColor','Texture / Color'],['wedgeMachine','Wedge Machine'],['extrusionWelder','Extrusion Welder'],['rodLot','Rod / Resin Lot'],['weather','Weather'],['shift','Shift']
      ] as [keyof ConstantData,string][]).map(([k,l]) => <label key={k}>{l}<input value={constants[k]} onChange={e=>updateConst(k,e.target.value)} /></label>)}
    </div></div>
    <div className="card"><h3>{editState ? 'Correct Log' : 'New Log'}</h3><label>Module<select value={activeType} onChange={e=>setActiveType(e.target.value as ModuleType)}>{MODULES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
      <div className="module-strip">{MODULES.map(m=><button key={m.id} className={activeType===m.id?'selected':''} onClick={()=>setActiveType(m.id)}>{m.icon}<span>{m.label}</span></button>)}</div>
      <label>Location<input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Seam, panel, pond, station..." /></label>
      <div className="form-grid">{FIELD_MAP[activeType].map(([label,key])=><label key={key}>{label}<input value={fields[key]||''} onChange={e=>setFields({...fields,[key]:e.target.value})}/></label>)}</div>
      <label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <div className="button-row"><button onClick={captureGps}><Camera size={16}/> Capture GPS/Time</button><button onClick={()=>saveRecord(false)}><Save size={16}/> Save Draft</button><button className="green" onClick={()=>saveRecord(true)}><CheckCircle2 size={16}/> Approve / Lock</button></div>
      <p className="muted">{gps ? `GPS captured ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} ±${Math.round(gps.accuracy||0)}m at ${gps.capturedAt}` : 'GPS not captured yet.'}</p>
    </div></section>;
}

function Logs({records, allRecords, setRecords, query, setQuery, startEdit}:{records:QCRecord[]; allRecords:QCRecord[]; setRecords:(r:QCRecord[])=>void; query:string; setQuery:(v:string)=>void; startEdit:(r:QCRecord)=>void}){
  const [typeFilter, setTypeFilter] = useState<ModuleType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all'|'draft'|'locked'>('all');
  const [selectedId, setSelectedId] = useState('');
  const visible = records.filter(r => (typeFilter === 'all' || r.type === typeFilter) && (statusFilter === 'all' || r.status === statusFilter));
  const selected = allRecords.find(r => r.id === selectedId) || visible[0];

  function lockRecord(id: string) {
    setRecords(allRecords.map(r => r.id === id ? { ...r, status: 'locked', createdAtDisplay: `${r.createdAtDisplay} • LOCKED ${now12()}` } : r));
  }
  function deleteRecord(id: string) {
    setRecords(allRecords.filter(r => r.id !== id));
    if (selectedId === id) setSelectedId('');
  }
  function duplicateRecord(r: QCRecord) {
    const copy: QCRecord = { ...r, id: `LS-${Date.now()}`, title: `${r.title} COPY`, status: 'draft', createdAt: new Date().toISOString(), createdAtDisplay: now12() };
    setRecords([copy, ...allRecords]);
    setSelectedId(copy.id);
  }
  function exportOne(r: QCRecord) {
    downloadText(`${r.id}_${r.type}_record.json`, JSON.stringify(r, null, 2), 'application/json');
  }

  return <section className="page"><h2>Chunk 5: Last Logs / Saved Data Viewer</h2><p className="muted">Review what was captured. Edit bad entries without losing the original saved record. Lock the good ones.</p>
    <div className="kpis"><Kpi label="All Logs" value={allRecords.length}/><Kpi label="Visible" value={visible.length}/><Kpi label="Locked" value={allRecords.filter(r=>r.status==='locked').length}/><Kpi label="Drafts" value={allRecords.filter(r=>r.status==='draft').length}/></div>
    <div className="card"><div className="form-grid"><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search seam, roll, panel, repair, GPS, notes..." /></label><label>Module Filter<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value as ModuleType | 'all')}><option value="all">All Modules</option>{MODULES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><label>Status Filter<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as 'all'|'draft'|'locked')}><option value="all">All Status</option><option value="draft">Draft</option><option value="locked">Locked</option></select></label><label>Export Visible<button onClick={()=>downloadText('LinerSync_LastLogs_visible.csv', makeCsv(visible), 'text/csv')}><Download size={16}/> CSV</button></label></div></div>
    <div className="asbuilt-layout"><div className="log-list">{visible.length === 0 ? <div className="card"><h3>No saved logs found</h3><p className="muted">Go to Tap Capture and save the first record.</p></div> : visible.map(r=><article className="log" key={r.id} onClick={()=>setSelectedId(r.id)} style={{borderColor:selected?.id===r.id?'var(--orange)':'var(--line)', cursor:'pointer'}}><div><strong>{r.title}</strong><p>{r.createdAtDisplay} • {r.status.toUpperCase()} • {r.location || 'No location'}</p><p>Roll {r.constants.activeRollNumber || '-'} • Panel {r.constants.activePanel || '-'} • Seam {r.constants.activeSeam || '-'}</p><p>{Object.entries(r.fields).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join(' • ') || 'No field values'}</p><div className="button-row"><button onClick={(e)=>{e.stopPropagation(); startEdit(r);}}><Save size={14}/> Edit</button><button onClick={(e)=>{e.stopPropagation(); lockRecord(r.id);}}><CheckCircle2 size={14}/> Lock</button><button onClick={(e)=>{e.stopPropagation(); duplicateRecord(r);}}><Copy size={14}/> Copy</button><button onClick={(e)=>{e.stopPropagation(); exportOne(r);}}><Download size={14}/> JSON</button><button onClick={(e)=>{e.stopPropagation(); deleteRecord(r.id);}}><Trash2 size={14}/> Delete</button></div></div></article>)}</div>
      <div className="card point-list"><h3>Selected Record</h3>{selected ? <><p><b>ID:</b> {selected.id}</p><p><b>Type:</b> {selected.type}</p><p><b>Status:</b> {selected.status.toUpperCase()}</p><p><b>Date:</b> {selected.createdAtDisplay}</p><p><b>GPS:</b> {selected.gps ? `${selected.gps.lat.toFixed(6)}, ${selected.gps.lng.toFixed(6)} ±${Math.round(selected.gps.accuracy||0)}m` : 'Missing'}</p><p><b>Notes:</b> {selected.notes || '-'}</p><pre>{JSON.stringify({ constants:selected.constants, fields:selected.fields }, null, 2)}</pre><div className="button-row"><button onClick={()=>startEdit(selected)}>Edit Selected</button><button onClick={()=>lockRecord(selected.id)}>Approve / Lock</button><button onClick={()=>exportOne(selected)}>Export JSON</button></div></> : <p className="muted">Select a log to inspect it.</p>}</div></div>
  </section>;
}

function AsBuilt({points,setPoints,constants}:{points:AsBuiltPoint[];setPoints:(p:AsBuiltPoint[])=>void;constants:ConstantData}){
  const [kind, setKind] = useState<AsBuiltKind>('seam');
  const [filter, setFilter] = useState<AsBuiltKind | 'all'>('all');
  const shown = filter === 'all' ? points : points.filter(p => p.kind === filter);

  function placePoint(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const label = `${kind.toUpperCase()} • ${constants.activeSeam || constants.activePanel || constants.activeRollNumber || now12()}`;
    const point: AsBuiltPoint = { id: `AB-${Date.now()}`, kind, label, x, y, color: colorForKind(kind) };
    setPoints([point, ...points]);
  }

  function removePoint(id: string) {
    setPoints(points.filter(p => p.id !== id));
  }

  return <section className="page"><h2>As-Built Map</h2><p className="muted">Tap the site canvas to place seam, panel, repair, DT, or photo points. Saved logs still drop points automatically.</p>
    <div className="asbuilt-toolbar card">
      <label>Point Type<select value={kind} onChange={e=>setKind(e.target.value as AsBuiltKind)}><option value="seam">Seam</option><option value="panel">Panel</option><option value="repair">Repair</option><option value="dt">DT</option><option value="photo">Photo</option></select></label>
      <label>Filter<select value={filter} onChange={e=>setFilter(e.target.value as AsBuiltKind | 'all')}><option value="all">All</option><option value="seam">Seams</option><option value="panel">Panels</option><option value="repair">Repairs</option><option value="dt">DTs</option><option value="photo">Photos</option></select></label>
      <button onClick={()=>downloadText('LinerSync_AsBuilt_points.json', JSON.stringify(points, null, 2), 'application/json')}><Download size={16}/> Export Points</button>
    </div>
    <div className="asbuilt-layout"><div className="mapbox" onClick={placePoint}>{shown.map(p=><div key={p.id} className="pin" style={{left:`${p.x}%`,top:`${p.y}%`,background:p.color}} title={p.label}>{p.kind[0].toUpperCase()}</div>)}<div className="north">N</div><div className="map-hint">Tap map to place {kind.toUpperCase()}</div></div>
      <div className="card point-list"><h3>As-Built Points</h3>{shown.length===0 ? <p className="muted">No points yet.</p> : shown.map(p=><div className="point-row" key={p.id}><span style={{background:p.color}}>{p.kind[0].toUpperCase()}</span><div><strong>{p.label}</strong><p>{p.x.toFixed(1)}%, {p.y.toFixed(1)}%</p></div><button onClick={()=>removePoint(p.id)}><Trash2 size={14}/></button></div>)}</div></div>
  </section>;
}

function Vision({constants,gps,captureGps,points}:{constants:ConstantData;gps?:GPSPoint;captureGps:()=>void;points:AsBuiltPoint[]}){
  const target = points[0];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setCameraError('');
    } catch {
      setCameraError('Camera permission blocked or unavailable. Use Chrome/Safari permission settings.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => () => stopCamera(), []);

  return <section className="page"><h2>AR Vision HUD</h2><p className="muted">Live camera feed with field overlay. Next step after this is pinning real GPS targets into the camera view.</p>
    <div className="vision"><video ref={videoRef} autoPlay playsInline muted className={cameraOn ? 'camera-feed' : 'camera-feed hidden-video'} />{!cameraOn && <div className="camera-placeholder"><Camera size={54}/><p>Camera off</p></div>}<div className="reticle"></div><div className="hud top-left">ROLL {constants.activeRollNumber || '--'}<br/>SEAM {constants.activeSeam || '--'}<br/>PANEL {constants.activePanel || '--'}</div><div className="hud bottom-left">{gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : 'NO GPS LOCK'}</div><div className="hud top-right">TARGET<br/>{target?.label || 'No as-built point'}</div></div>
    {cameraError && <p className="issue danger"><strong>Camera issue</strong><br/>{cameraError}</p>}
    <div className="button-row"><button onClick={cameraOn ? stopCamera : startCamera}><Camera size={16}/> {cameraOn ? 'Stop Camera' : 'Start Camera'}</button><button onClick={captureGps}><Crosshair size={16}/> Capture Current Position</button></div>
  </section>;
}

function Mythos({ constants, records, points, setTab }: { constants: ConstantData; records: QCRecord[]; points: AsBuiltPoint[]; setTab: (t: any)=>void }) {
  const issues = analyzeMythos(constants, records);
  const counts = { seams: records.filter(r => r.type === 'seam').length, panels: records.filter(r => r.type === 'panel').length, repairs: records.filter(r => r.type === 'repair').length, tests: records.filter(r => r.type === 'dt' || r.type === 'air' || r.type === 'wedge').length };
  const dailySummary = records.slice(0, 8).map(r => `${r.createdAtDisplay}: ${r.title}`).join('\n') || 'No records saved yet.';

  return <section className="page mythos-page">
    <div className="mythos-hero"><Brain size={42}/><div><h2>Mythos Field Agent</h2><p>QC assistant watching logs, constants, GPS, seams, tests, as-built points, and missing data.</p></div></div>
    <div className="card mythos-command"><div className="tiny">NEXT PROVEN ACTION</div><h3>{nextMythosAction(constants, records)}</h3><div className="button-row"><button onClick={()=>setTab('capture')}><Plus size={16}/> Go Capture</button><button onClick={()=>setTab('logs')}><Archive size={16}/> Review Logs</button><button onClick={()=>setTab('asbuilt')}><Map size={16}/> View As-Built</button><button onClick={()=>setTab('vision')}><Eye size={16}/> Open AR</button></div></div>
    <div className="kpis"><Kpi label="Seams" value={counts.seams}/><Kpi label="Panels" value={counts.panels}/><Kpi label="Repairs" value={counts.repairs}/><Kpi label="As-Built" value={points.length}/></div>
    <div className="mythos-grid"><div className="card"><h3>QC Watch List</h3><div className="issue-list">{issues.map((i,idx)=><div key={idx} className={`issue ${i.level}`}><strong>{i.title}</strong><p>{i.detail}</p><span>{i.action}</span></div>)}</div></div><div className="card"><h3>What Mythos Knows Now</h3><p><b>Project:</b> {constants.projectName || 'Missing'}</p><p><b>Roll:</b> {constants.activeRollNumber || 'Missing'}</p><p><b>Panel:</b> {constants.activePanel || 'Missing'}</p><p><b>Seam:</b> {constants.activeSeam || 'Missing'}</p><p><b>Liner:</b> {[constants.linerWidth, constants.linerThickness, constants.linerType].filter(Boolean).join(' / ') || 'Missing'}</p></div><div className="card wide"><h3>Daily Summary Draft</h3><pre>{dailySummary}</pre></div></div>
  </section>;
}

function Exports({records,points,exportBackup,exportCsv}:{records:QCRecord[];points:AsBuiltPoint[];exportBackup:()=>void;exportCsv:()=>void}){
  return <section className="page"><h2>Export</h2><div className="card"><p>{records.length} records and {points.length} as-built points ready.</p><div className="button-row"><button onClick={exportCsv}><Download size={16}/> CSV Export</button><button onClick={exportBackup}><Download size={16}/> JSON Backup</button><button onClick={()=>downloadText('LinerSync_AsBuilt_points.json', JSON.stringify(points, null, 2), 'application/json')}><Map size={16}/> As-Built JSON</button></div></div></section>;
}

createRoot(document.getElementById('root')!).render(<App />);
