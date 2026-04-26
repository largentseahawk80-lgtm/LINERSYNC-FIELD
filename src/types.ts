export type ModuleType =
  | 'roll'
  | 'panel'
  | 'seam'
  | 'wedge'
  | 'extrusion'
  | 'air'
  | 'dt'
  | 'repair'
  | 'daily';

export type ConstantData = {
  projectName: string;
  client: string;
  qcTech: string;
  installer: string;
  crew: string;
  activeRollNumber: string;
  activePanel: string;
  activeSeam: string;
  linerType: string;
  linerThickness: string;
  linerWidth: string;
  textureColor: string;
  wedgeMachine: string;
  extrusionWelder: string;
  rodLot: string;
  weather: string;
  shift: string;
};

export type GPSPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt: string;
};

export type QCRecord = {
  id: string;
  type: ModuleType;
  title: string;
  location: string;
  status: 'draft' | 'locked';
  constants: ConstantData;
  fields: Record<string, string>;
  gps?: GPSPoint;
  createdAt: string;
  createdAtDisplay: string;
  notes: string;
};

export type AsBuiltPoint = {
  id: string;
  kind: 'panel' | 'seam' | 'repair' | 'dt' | 'photo';
  label: string;
  x: number;
  y: number;
  recordId?: string;
  color: string;
};
