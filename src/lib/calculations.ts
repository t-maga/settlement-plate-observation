import type { Observation, RodHistory, StationMaster } from "./types";

export const round3 = (value: number) => Math.round(value * 1000) / 1000;

export const todayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function generateStations(routeName: string, start: number, end: number, interval: number): StationMaster[] {
  if (!routeName.trim() || interval <= 0 || end < start) {
    return [];
  }

  const stations: StationMaster[] = [];
  for (let value = start; value <= end; value += interval) {
    stations.push({
      id: createId(),
      routeName: routeName.trim(),
      name: `SP${value}`,
      value
    });
  }

  return stations;
}

export function rodKey(projectName: string, routeName: string, stationName: string, position: string) {
  return [projectName, routeName, stationName, position].map((part) => part.trim()).join("__");
}

export function samePoint(observation: Observation, projectName: string, routeName: string, stationName: string, position: string) {
  return (
    observation.projectName === projectName &&
    observation.routeName === routeName &&
    observation.stationName === stationName &&
    observation.position === position
  );
}

export function getRodTotal(history: RodHistory | undefined, fallbackInitialLength: number, pendingExtension = 0) {
  const initial = history?.initialRodLength ?? fallbackInitialLength;
  const extensionTotal = history?.extensions.reduce((sum, entry) => sum + entry.length, 0) ?? 0;

  return {
    initialRodLength: round3(initial),
    extensionLength: round3(extensionTotal + pendingExtension),
    totalRodLength: round3(initial + extensionTotal + pendingExtension)
  };
}

export function getPreviousObservation(
  observations: Observation[],
  projectName: string,
  routeName: string,
  stationName: string,
  position: string,
  measurementDate: string
) {
  return observations
    .filter((observation) => samePoint(observation, projectName, routeName, stationName, position))
    .filter((observation) => observation.measurementDate < measurementDate)
    .sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))[0];
}

export function getInitialObservation(
  observations: Observation[],
  projectName: string,
  routeName: string,
  stationName: string,
  position: string
) {
  return observations
    .filter((observation) => samePoint(observation, projectName, routeName, stationName, position))
    .sort((a, b) => a.measurementDate.localeCompare(b.measurementDate))[0];
}

export function buildObservation(input: {
  id?: string;
  observations: Observation[];
  projectName: string;
  routeName: string;
  stationName: string;
  position: string;
  measurementDate: string;
  bmName: string;
  bmElevation: number;
  backsight: number;
  foresight: number;
  initialRodLength: number;
  extensionLength: number;
  totalRodLength: number;
  memo?: string;
}): Observation {
  const instrumentHeight = round3(input.bmElevation + input.backsight);
  const rodTopElevation = round3(instrumentHeight - input.foresight);
  const settlementPlateElevation = round3(rodTopElevation - input.totalRodLength);
  const previous = getPreviousObservation(
    input.observations,
    input.projectName,
    input.routeName,
    input.stationName,
    input.position,
    input.measurementDate
  );
  const initial = getInitialObservation(
    input.observations,
    input.projectName,
    input.routeName,
    input.stationName,
    input.position
  );
  const initialElevation = initial?.settlementPlateElevation ?? settlementPlateElevation;

  return {
    id: input.id ?? createId(),
    projectName: input.projectName,
    routeName: input.routeName,
    stationName: input.stationName,
    position: input.position,
    measurementDate: input.measurementDate,
    bmName: input.bmName,
    bmElevation: round3(input.bmElevation),
    backsight: round3(input.backsight),
    instrumentHeight,
    foresight: round3(input.foresight),
    rodTopElevation,
    initialRodLength: round3(input.initialRodLength),
    extensionLength: round3(input.extensionLength),
    totalRodLength: round3(input.totalRodLength),
    settlementPlateElevation,
    settlementAmount: round3(initialElevation - settlementPlateElevation),
    dailySettlementAmount: round3((previous?.settlementPlateElevation ?? settlementPlateElevation) - settlementPlateElevation),
    memo: input.memo?.trim() || undefined
  };
}
