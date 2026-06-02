import type { Observation } from "./types";

const OBSERVATION_COLUMNS: (keyof Observation)[] = [
  "id",
  "projectName",
  "routeName",
  "stationName",
  "position",
  "measurementDate",
  "bmName",
  "bmElevation",
  "backsight",
  "instrumentHeight",
  "foresight",
  "rodTopElevation",
  "initialRodLength",
  "extensionLength",
  "totalRodLength",
  "settlementPlateElevation",
  "settlementAmount",
  "dailySettlementAmount",
  "memo"
];

const NUMERIC_COLUMNS = new Set<keyof Observation>([
  "bmElevation",
  "backsight",
  "instrumentHeight",
  "foresight",
  "rodTopElevation",
  "initialRodLength",
  "extensionLength",
  "totalRodLength",
  "settlementPlateElevation",
  "settlementAmount",
  "dailySettlementAmount"
]);

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function observationsToCsv(observations: Observation[]) {
  const rows = [
    OBSERVATION_COLUMNS.join(","),
    ...observations.map((observation) => OBSERVATION_COLUMNS.map((key) => csvEscape(observation[key])).join(","))
  ];

  return `\uFEFF${rows.join("\r\n")}`;
}

export function csvToObservations(csv: string): Observation[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseLine(lines[0] ?? "") as (keyof Observation)[];

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const record = {} as Observation;

    headers.forEach((header, index) => {
      const value = values[index] ?? "";
      Object.assign(record, {
        [header]: NUMERIC_COLUMNS.has(header) ? Number(value) || 0 : value
      });
    });

    return record;
  });
}

export function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
