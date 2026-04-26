import type { ConstantData, QCRecord, AsBuiltPoint } from './types';

export const DEFAULT_CONSTANTS: ConstantData = {
  projectName: '',
  client: '',
  qcTech: 'Steveo',
  installer: '',
  crew: '',
  activeRollNumber: '',
  activePanel: '',
  activeSeam: '',
  linerType: 'HDPE',
  linerThickness: '60 mil',
  linerWidth: '23 ft',
  textureColor: '',
  wedgeMachine: '',
  extrusionWelder: '',
  rodLot: '',
  weather: '',
  shift: 'Day'
};

export function loadConstants(): ConstantData {
  const raw = localStorage.getItem('linersync.constants');
  return raw ? { ...DEFAULT_CONSTANTS, ...JSON.parse(raw) } : DEFAULT_CONSTANTS;
}

export function saveConstants(data: ConstantData) {
  localStorage.setItem('linersync.constants', JSON.stringify(data));
}

export function loadRecords(): QCRecord[] {
  const raw = localStorage.getItem('linersync.records');
  return raw ? JSON.parse(raw) : [];
}

export function saveRecords(records: QCRecord[]) {
  localStorage.setItem('linersync.records', JSON.stringify(records));
}

export function loadAsBuilt(): AsBuiltPoint[] {
  const raw = localStorage.getItem('linersync.asbuilt');
  return raw ? JSON.parse(raw) : [];
}

export function saveAsBuilt(points: AsBuiltPoint[]) {
  localStorage.setItem('linersync.asbuilt', JSON.stringify(points));
}

export function now12() {
  return new Date().toLocaleString([], {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });
}

export function makeCsv(records: QCRecord[]) {
  const headers = [
    'ID','Type','Title','Status','Date Time','Project','Client','QC Tech','Installer','Crew',
    'Roll Number','Panel','Seam','Liner Type','Thickness','Width','Texture Color',
    'Wedge Machine','Extrusion Welder','Rod Lot','Weather','Shift','Location',
    'Latitude','Longitude','GPS Accuracy','Fields','Notes'
  ];
  const safe = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = records.map(r => [
    r.id, r.type, r.title, r.status, r.createdAtDisplay, r.constants.projectName, r.constants.client,
    r.constants.qcTech, r.constants.installer, r.constants.crew, r.constants.activeRollNumber,
    r.constants.activePanel, r.constants.activeSeam, r.constants.linerType, r.constants.linerThickness,
    r.constants.linerWidth, r.constants.textureColor, r.constants.wedgeMachine, r.constants.extrusionWelder,
    r.constants.rodLot, r.constants.weather, r.constants.shift, r.location, r.gps?.lat, r.gps?.lng,
    r.gps?.accuracy, JSON.stringify(r.fields), r.notes
  ].map(safe).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
