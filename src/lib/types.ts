export interface Observation {
  id: string;
  projectName: string;
  routeName: string;
  stationName: string;
  position: string;
  measurementDate: string;

  bmName: string;
  bmElevation: number;
  backsight: number;
  instrumentHeight: number;

  foresight: number;

  rodTopElevation: number;

  initialRodLength: number;
  extensionLength: number;
  totalRodLength: number;

  settlementPlateElevation: number;

  settlementAmount: number;
  dailySettlementAmount: number;

  memo?: string;
}

export interface RouteMaster {
  id: string;
  name: string;
}

export interface StationMaster {
  id: string;
  routeName: string;
  name: string;
  value: number;
}

export interface PositionMaster {
  id: string;
  name: string;
}

export interface Benchmark {
  id: string;
  name: string;
  elevation: number;
  defaultBacksight: number;
}

export interface RodExtensionEntry {
  id: string;
  date: string;
  length: number;
  memo?: string;
}

export interface RodHistory {
  id: string;
  projectName: string;
  routeName: string;
  stationName: string;
  position: string;
  initialRodLength: number;
  extensions: RodExtensionEntry[];
}

export interface AppSettings {
  abnormalDailySettlementThreshold: number;
  abnormalSettlementThreshold: number;
}

export interface AppData {
  routes: RouteMaster[];
  stations: StationMaster[];
  positions: PositionMaster[];
  benchmarks: Benchmark[];
  rodHistories: RodHistory[];
  observations: Observation[];
  settings: AppSettings;
}

export interface LastSession {
  projectName: string;
  routeName: string;
  stationName: string;
  position: string;
  measurementDate: string;
  bmName: string;
}

export type ImportMode = "append" | "overwrite";
