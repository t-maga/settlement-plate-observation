import { generateStations } from "./calculations";
import type { AppData } from "./types";

export const createDefaultData = (): AppData => ({
  routes: [
    { id: "route-main", name: "本線" },
    { id: "route-detour", name: "迂回路" },
    { id: "route-ramp", name: "ランプ" },
    { id: "route-side", name: "側道" }
  ],
  stations: generateStations("本線", 14760, 15040, 40),
  positions: ["R3", "R2", "R1", "CL", "L1", "L2", "L3"].map((name) => ({
    id: `position-${name}`,
    name
  })),
  benchmarks: [
    {
      id: "bm-1",
      name: "BM-1",
      elevation: 10,
      defaultBacksight: 1.5
    }
  ],
  rodHistories: [],
  observations: [],
  settings: {
    abnormalDailySettlementThreshold: 0.05,
    abnormalSettlementThreshold: 0.3
  }
});
