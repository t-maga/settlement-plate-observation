"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileJson,
  Gauge,
  History,
  Import,
  Map,
  Plus,
  Route,
  Save,
  Settings,
  Upload
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  buildObservation,
  createId,
  generateStations,
  getPreviousObservation,
  getRodTotal,
  rodKey,
  round3,
  todayString
} from "@/lib/calculations";
import { csvToObservations, downloadText, observationsToCsv } from "@/lib/csv";
import { createDefaultData } from "@/lib/defaultData";
import { loadAppData, loadLastSession, saveAppData, saveLastSession } from "@/lib/storage";
import type { AppData, Benchmark, ImportMode, LastSession, Observation, RodHistory } from "@/lib/types";

type Tab = "dashboard" | "input" | "masters" | "export";

interface Draft {
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
  pendingExtension: number;
  memo: string;
}

const defaultData = createDefaultData();
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const makeInitialDraft = (data: AppData = defaultData): Draft => {
  const routeName = data.routes[0]?.name ?? "本線";
  const stationName = data.stations.find((station) => station.routeName === routeName)?.name ?? "";
  const position = data.positions[0]?.name ?? "R3";
  const bm = data.benchmarks[0];

  return {
    projectName: "軟弱地盤工事",
    routeName,
    stationName,
    position,
    measurementDate: todayString(),
    bmName: bm?.name ?? "",
    bmElevation: bm?.elevation ?? 0,
    backsight: bm?.defaultBacksight ?? 0,
    foresight: 0,
    initialRodLength: 1,
    pendingExtension: 0,
    memo: ""
  };
};

function numberValue(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function Field({ label, value, onChange, step = "0.001", min, suffix }: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  min?: number;
  suffix?: string;
}) {
  const displayValue = Number.isFinite(value) ? String(value) : "";

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      <div className="flex min-h-[58px] items-center overflow-hidden rounded-md border-2 border-slate-300 bg-white focus-within:border-cyan-600">
        <input
          className="h-[58px] w-full px-4 text-2xl font-bold text-slate-950 outline-none"
          inputMode="decimal"
          min={min}
          step={step}
          type="number"
          value={displayValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue === "" ? Number.NaN : Number(nextValue));
          }}
        />
        {suffix ? <span className="shrink-0 px-3 text-base font-bold text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function Stat({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "cyan" | "amber" | "red" }) {
  const toneClass = {
    slate: "border-slate-200 bg-white text-slate-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950"
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="text-xs font-bold text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-200 py-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2 text-slate-900">
        {icon}
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function FieldApp() {
  const [data, setData] = useState<AppData>(defaultData);
  const [draft, setDraft] = useState<Draft>(() => makeInitialDraft(defaultData));
  const [activeTab, setActiveTab] = useState<Tab>("input");
  const [hydrated, setHydrated] = useState(false);
  const [resumeSession, setResumeSession] = useState<LastSession | undefined>();
  const [status, setStatus] = useState("IndexedDBへ自動保存");
  const [routeForm, setRouteForm] = useState({ routeName: "本線", start: 14760, end: 15040, interval: 40 });
  const [positionText, setPositionText] = useState("R3\nR2\nR1\nCL\nL1\nL2\nL3");
  const [bmForm, setBmForm] = useState({ name: "BM-1", elevation: 10, defaultBacksight: 1.5 });
  const [importMode, setImportMode] = useState<ImportMode>("append");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath || ""}/` }).catch(() => undefined);
    }

    loadAppData(defaultData).then((loaded) => {
      setData(loaded);
      setPositionText(loaded.positions.map((position) => position.name).join("\n"));
      const last = loadLastSession();
      if (last) {
        setResumeSession(last);
      } else {
        setDraft(makeInitialDraft(loaded));
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveAppData(data)
      .then(() => setStatus(`保存済み ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`))
      .catch(() => setStatus("保存に失敗しました"));
  }, [data, hydrated]);

  const routeStations = useMemo(
    () => data.stations.filter((station) => station.routeName === draft.routeName).sort((a, b) => a.value - b.value),
    [data.stations, draft.routeName]
  );
  const selectedBenchmark = data.benchmarks.find((benchmark) => benchmark.name === draft.bmName);
  const currentRodKey = rodKey(draft.projectName, draft.routeName, draft.stationName, draft.position);
  const rodHistory = data.rodHistories.find(
    (history) => rodKey(history.projectName, history.routeName, history.stationName, history.position) === currentRodKey
  );
  const rodLengths = getRodTotal(rodHistory, numberValue(draft.initialRodLength), numberValue(draft.pendingExtension));
  const previous = getPreviousObservation(
    data.observations,
    draft.projectName,
    draft.routeName,
    draft.stationName,
    draft.position,
    draft.measurementDate
  );
  const preview = buildObservation({
    observations: data.observations,
    projectName: draft.projectName,
    routeName: draft.routeName,
    stationName: draft.stationName,
    position: draft.position,
    measurementDate: draft.measurementDate,
    bmName: draft.bmName,
    bmElevation: numberValue(draft.bmElevation),
    backsight: numberValue(draft.backsight),
    foresight: numberValue(draft.foresight),
    initialRodLength: rodLengths.initialRodLength,
    extensionLength: rodLengths.extensionLength,
    totalRodLength: rodLengths.totalRodLength,
    memo: draft.memo
  });
  const isAbnormal =
    Math.abs(preview.dailySettlementAmount) > data.settings.abnormalDailySettlementThreshold ||
    Math.abs(preview.settlementAmount) > data.settings.abnormalSettlementThreshold;
  const today = todayString();
  const todayCount = data.observations.filter((observation) => observation.measurementDate === today).length;
  const observedToday = new Set(
    data.observations
      .filter((observation) => observation.measurementDate === today && observation.routeName === draft.routeName)
      .map((observation) => `${observation.stationName}-${observation.position}`)
  );
  const unobservedCount = routeStations.length * data.positions.length - observedToday.size;
  const recentAbnormal = data.observations
    .filter(
      (observation) =>
        Math.abs(observation.dailySettlementAmount) > data.settings.abnormalDailySettlementThreshold ||
        Math.abs(observation.settlementAmount) > data.settings.abnormalSettlementThreshold
    )
    .sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))
    .slice(0, 5);
  const settlementRanking = [...data.observations]
    .sort((a, b) => Math.abs(b.settlementAmount) - Math.abs(a.settlementAmount))
    .slice(0, 5);

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      saveLastSession({
        projectName: next.projectName,
        routeName: next.routeName,
        stationName: next.stationName,
        position: next.position,
        measurementDate: next.measurementDate,
        bmName: next.bmName
      });
      return next;
    });
  };

  const applyBenchmark = (benchmark: Benchmark | undefined) => {
    if (!benchmark) {
      return;
    }
    updateDraft({
      bmName: benchmark.name,
      bmElevation: benchmark.elevation,
      backsight: benchmark.defaultBacksight
    });
  };

  const applySession = (session: LastSession) => {
    const benchmark = data.benchmarks.find((bm) => bm.name === session.bmName) ?? data.benchmarks[0];
    setDraft({
      ...makeInitialDraft(data),
      ...session,
      bmElevation: benchmark?.elevation ?? 0,
      backsight: benchmark?.defaultBacksight ?? 0
    });
    setResumeSession(undefined);
  };

  const saveObservation = () => {
    if (!draft.projectName.trim() || !draft.routeName || !draft.stationName || !draft.position || !draft.measurementDate) {
      setStatus("現場名・路線・測点・位置・日付を確認してください");
      return;
    }

    const existing = data.observations.find(
      (observation) =>
        observation.projectName === draft.projectName &&
        observation.routeName === draft.routeName &&
        observation.stationName === draft.stationName &&
        observation.position === draft.position &&
        observation.measurementDate === draft.measurementDate
    );
    const observationsWithoutExisting = data.observations.filter((observation) => observation.id !== existing?.id);
    const observation = buildObservation({
      id: existing?.id,
      observations: observationsWithoutExisting,
      projectName: draft.projectName.trim(),
      routeName: draft.routeName,
      stationName: draft.stationName,
      position: draft.position,
      measurementDate: draft.measurementDate,
      bmName: draft.bmName,
      bmElevation: numberValue(draft.bmElevation),
      backsight: numberValue(draft.backsight),
      foresight: numberValue(draft.foresight),
      initialRodLength: rodLengths.initialRodLength,
      extensionLength: rodLengths.extensionLength,
      totalRodLength: rodLengths.totalRodLength,
      memo: draft.memo
    });
    const pendingExtension = numberValue(draft.pendingExtension);
    let nextRodHistories = data.rodHistories;

    if (!rodHistory || pendingExtension !== 0) {
      const base: RodHistory =
        rodHistory ?? {
          id: createId(),
          projectName: draft.projectName.trim(),
          routeName: draft.routeName,
          stationName: draft.stationName,
          position: draft.position,
          initialRodLength: rodLengths.initialRodLength,
          extensions: []
        };
      const nextHistory: RodHistory = {
        ...base,
        initialRodLength: rodLengths.initialRodLength,
        extensions:
          pendingExtension !== 0
            ? [
                ...base.extensions,
                {
                  id: createId(),
                  date: draft.measurementDate,
                  length: round3(pendingExtension),
                  memo: draft.memo || undefined
                }
              ]
            : base.extensions
      };
      nextRodHistories = [...data.rodHistories.filter((history) => history.id !== base.id), nextHistory];
    }

    setData((current) => ({
      ...current,
      rodHistories: nextRodHistories,
      observations: [...observationsWithoutExisting, observation].sort((a, b) =>
        `${b.measurementDate}${b.routeName}${b.stationName}`.localeCompare(`${a.measurementDate}${a.routeName}${a.stationName}`)
      )
    }));
    updateDraft({ pendingExtension: 0, memo: "" });
    setStatus(existing ? "同一日データを更新しました" : "観測データを登録しました");
  };

  const addStations = () => {
    const generated = generateStations(routeForm.routeName, routeForm.start, routeForm.end, routeForm.interval);
    const routes = data.routes.some((route) => route.name === routeForm.routeName)
      ? data.routes
      : [...data.routes, { id: createId(), name: routeForm.routeName }];
    setData((current) => ({
      ...current,
      routes,
      stations: [
        ...current.stations.filter((station) => station.routeName !== routeForm.routeName),
        ...generated
      ]
    }));
    updateDraft({ routeName: routeForm.routeName, stationName: generated[0]?.name ?? draft.stationName });
  };

  const savePositions = () => {
    const positions = positionText
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: createId(), name }));
    setData((current) => ({ ...current, positions }));
    updateDraft({ position: positions[0]?.name ?? draft.position });
  };

  const addBenchmark = () => {
    const nextBm = {
      id: createId(),
      name: bmForm.name.trim(),
      elevation: numberValue(bmForm.elevation),
      defaultBacksight: numberValue(bmForm.defaultBacksight)
    };
    if (!nextBm.name) {
      return;
    }
    setData((current) => ({
      ...current,
      benchmarks: [...current.benchmarks.filter((bm) => bm.name !== nextBm.name), nextBm]
    }));
    applyBenchmark(nextBm);
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const imported = csvToObservations(text).filter((observation) => observation.id);
    setData((current) => ({
      ...current,
      observations:
        importMode === "overwrite"
          ? imported
          : [...current.observations.filter((observation) => !imported.some((item) => item.id === observation.id)), ...imported]
    }));
    setStatus(`${imported.length}件のCSVを取込しました`);
    event.target.value = "";
  };

  const exportAllCsv = () => {
    downloadText(`settlement-observations-all-${today}.csv`, observationsToCsv(data.observations), "text/csv;charset=utf-8");
  };

  const exportTodayCsv = () => {
    const todays = data.observations.filter((observation) => observation.measurementDate === today);
    downloadText(`settlement-observations-${today}.csv`, observationsToCsv(todays), "text/csv;charset=utf-8");
  };

  const exportJson = () => {
    downloadText(`settlement-observations-${today}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-3 pb-24 pt-4 sm:px-5">
      <header className="mb-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-cyan-200">軟弱地盤動態観測システム</p>
            <h1 className="text-2xl font-black sm:text-3xl">沈下板観測 Field</h1>
          </div>
          <div className="rounded-md bg-white/10 px-3 py-2 text-right">
            <div className="text-xs text-slate-200">状態</div>
            <div className="text-sm font-bold">{status}</div>
          </div>
        </div>
      </header>

      {resumeSession ? (
        <div className="mb-4 rounded-md border-2 border-amber-300 bg-amber-50 p-4 shadow-field">
          <div className="flex items-start gap-3">
            <History className="mt-1 h-6 w-6 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black text-amber-950">前回作業を再開しますか？</div>
              <div className="mt-1 text-sm font-bold text-amber-900">
                {resumeSession.projectName} / {resumeSession.routeName} / {resumeSession.stationName} / {resumeSession.position}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="min-h-[48px] rounded-md bg-amber-500 px-4 font-black text-white" onClick={() => applySession(resumeSession)}>
                  再開
                </button>
                <button
                  className="min-h-[48px] rounded-md border-2 border-slate-300 bg-white px-4 font-black text-slate-900"
                  onClick={() => {
                    setDraft(makeInitialDraft(data));
                    setResumeSession(undefined);
                  }}
                >
                  新規
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="sticky top-0 z-10 -mx-3 mb-4 grid grid-cols-4 gap-1 bg-slate-900 px-3 py-2 sm:-mx-5 sm:px-5">
        {[
          { key: "dashboard", label: "状況", icon: BarChart3 },
          { key: "input", label: "入力", icon: ClipboardList },
          { key: "masters", label: "設定", icon: Settings },
          { key: "export", label: "出力", icon: Database }
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              className={`flex min-h-[52px] items-center justify-center gap-1 rounded-md text-sm font-black ${
                active ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-white"
              }`}
              onClick={() => setActiveTab(item.key as Tab)}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="rounded-md bg-white p-4 shadow-field sm:p-5">
        {activeTab === "dashboard" ? (
          <div>
            <Section title="ダッシュボード" icon={<Gauge className="h-6 w-6 text-cyan-700" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="今日の観測件数" value={todayCount} tone="cyan" />
                <Stat label="未観測測点" value={Math.max(0, unobservedCount)} tone="amber" />
                <Stat label="登録履歴" value={data.observations.length} />
                <Stat label="異常候補" value={recentAbnormal.length} tone={recentAbnormal.length ? "red" : "slate"} />
              </div>
            </Section>

            <Section title="最近の異常値" icon={<AlertTriangle className="h-6 w-6 text-red-700" />}>
              <List observations={recentAbnormal} empty="異常値はありません" />
            </Section>

            <Section title="沈下量ランキング" icon={<BarChart3 className="h-6 w-6 text-amber-700" />}>
              <List observations={settlementRanking} empty="観測データがありません" />
            </Section>
          </div>
        ) : null}

        {activeTab === "input" ? (
          <div>
            <Section title="観測点" icon={<Map className="h-6 w-6 text-cyan-700" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">現場名</span>
                  <input
                    className="min-h-[54px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold"
                    value={draft.projectName}
                    onChange={(event) => updateDraft({ projectName: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">観測日</span>
                  <input
                    className="min-h-[54px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold"
                    type="date"
                    value={draft.measurementDate}
                    onChange={(event) => updateDraft({ measurementDate: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">路線</span>
                  <select
                    className="min-h-[54px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold"
                    value={draft.routeName}
                    onChange={(event) => {
                      const station = data.stations.find((item) => item.routeName === event.target.value);
                      updateDraft({ routeName: event.target.value, stationName: station?.name ?? "" });
                    }}
                  >
                    {data.routes.map((route) => (
                      <option key={route.id} value={route.name}>
                        {route.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">測点</span>
                  <select
                    className="min-h-[54px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold"
                    value={draft.stationName}
                    onChange={(event) => updateDraft({ stationName: event.target.value })}
                  >
                    {routeStations.map((station) => (
                      <option key={station.id} value={station.name}>
                        {station.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {data.positions.map((position) => (
                  <button
                    key={position.id}
                    className={`min-h-[52px] rounded-md border-2 text-lg font-black ${
                      draft.position === position.name
                        ? "border-cyan-700 bg-cyan-300 text-slate-950"
                        : "border-slate-300 bg-white text-slate-800"
                    }`}
                    onClick={() => updateDraft({ position: position.name })}
                  >
                    {position.name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="BM・レベル観測" icon={<Route className="h-6 w-6 text-amber-700" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">BM名称</span>
                  <select
                    className="min-h-[58px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold"
                    value={draft.bmName}
                    onChange={(event) => applyBenchmark(data.benchmarks.find((bm) => bm.name === event.target.value))}
                  >
                    {data.benchmarks.map((bm) => (
                      <option key={bm.id} value={bm.name}>
                        {bm.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="BM標高" suffix="m" value={draft.bmElevation} onChange={(value) => updateDraft({ bmElevation: value })} />
                <Field label="後視値" suffix="m" value={draft.backsight} onChange={(value) => updateDraft({ backsight: value })} />
                <Field label="前視値" suffix="m" value={draft.foresight} onChange={(value) => updateDraft({ foresight: value })} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="器械高" value={`${preview.instrumentHeight.toFixed(3)} m`} tone="cyan" />
                <Stat label="ロッド天端標高" value={`${preview.rodTopElevation.toFixed(3)} m`} />
                <Stat label="沈下板標高" value={`${preview.settlementPlateElevation.toFixed(3)} m`} tone="amber" />
                <Stat label="日沈下量" value={`${preview.dailySettlementAmount.toFixed(3)} m`} tone={isAbnormal ? "red" : "slate"} />
              </div>
            </Section>

            <Section title="ロッド長" icon={<History className="h-6 w-6 text-slate-700" />}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="初期ロッド長" suffix="m" min={0} value={rodHistory?.initialRodLength ?? draft.initialRodLength} onChange={(value) => updateDraft({ initialRodLength: value })} />
                <Field label="今回継ぎ足し" suffix="m" value={draft.pendingExtension} onChange={(value) => updateDraft({ pendingExtension: value })} />
                <div className="rounded-md border-2 border-slate-300 bg-slate-50 p-3">
                  <div className="text-sm font-bold text-slate-700">累積ロッド長</div>
                  <div className="mt-1 text-3xl font-black text-slate-950">{rodLengths.totalRodLength.toFixed(3)} m</div>
                </div>
              </div>
              {rodHistory?.extensions.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="p-2">日付</th>
                        <th className="p-2">継ぎ足し</th>
                        <th className="p-2">メモ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rodHistory.extensions.map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-100">
                          <td className="p-2 font-bold">{entry.date}</td>
                          <td className="p-2">{entry.length.toFixed(3)} m</td>
                          <td className="p-2">{entry.memo ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Section>

            <Section title="入力支援" icon={<CheckCircle2 className="h-6 w-6 text-emerald-700" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="前回観測日" value={previous?.measurementDate ?? "-"} />
                <Stat label="前回前視値" value={previous ? `${previous.foresight.toFixed(3)} m` : "-"} />
                <Stat label="前回沈下板標高" value={previous ? `${previous.settlementPlateElevation.toFixed(3)} m` : "-"} />
                <Stat label="前回沈下量" value={previous ? `${previous.settlementAmount.toFixed(3)} m` : "-"} />
              </div>
              {isAbnormal ? (
                <div className="mt-3 rounded-md border-2 border-red-300 bg-red-50 p-3 text-red-950">
                  <div className="flex items-center gap-2 font-black">
                    <AlertTriangle className="h-5 w-5" />
                    閾値を超えています
                  </div>
                  <p className="mt-1 text-sm font-bold">
                    日沈下量または累積沈下量が設定値を超えました。BM、前視値、ロッド継ぎ足し履歴を確認してください。
                  </p>
                </div>
              ) : null}
              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-bold text-slate-700">メモ</span>
                <textarea
                  className="min-h-[86px] w-full rounded-md border-2 border-slate-300 p-3 text-lg font-bold"
                  value={draft.memo}
                  onChange={(event) => updateDraft({ memo: event.target.value })}
                />
              </label>
              <button className="mt-4 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-5 text-xl font-black text-white" onClick={saveObservation}>
                <Save className="h-6 w-6" />
                観測データ登録
              </button>
            </Section>
          </div>
        ) : null}

        {activeTab === "masters" ? (
          <div>
            <Section title="路線・測点自動生成" icon={<Route className="h-6 w-6 text-cyan-700" />}>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block sm:col-span-4">
                  <span className="mb-2 block text-sm font-bold text-slate-700">路線名</span>
                  <input className="min-h-[54px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold" value={routeForm.routeName} onChange={(event) => setRouteForm({ ...routeForm, routeName: event.target.value })} />
                </label>
                <Field label="開始測点" step="1" value={routeForm.start} onChange={(value) => setRouteForm({ ...routeForm, start: value })} />
                <Field label="終了測点" step="1" value={routeForm.end} onChange={(value) => setRouteForm({ ...routeForm, end: value })} />
                <Field label="計測間隔" step="1" min={1} value={routeForm.interval} onChange={(value) => setRouteForm({ ...routeForm, interval: value })} />
                <button className="flex min-h-[58px] items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 font-black text-white" onClick={addStations}>
                  <Plus className="h-5 w-5" />
                  生成
                </button>
              </div>
            </Section>

            <Section title="観測位置マスタ" icon={<Settings className="h-6 w-6 text-slate-700" />}>
              <textarea className="min-h-[190px] w-full rounded-md border-2 border-slate-300 p-3 text-xl font-black" value={positionText} onChange={(event) => setPositionText(event.target.value)} />
              <button className="mt-3 min-h-[54px] rounded-md bg-slate-950 px-5 font-black text-white" onClick={savePositions}>
                位置マスタ保存
              </button>
            </Section>

            <Section title="BM管理" icon={<Gauge className="h-6 w-6 text-amber-700" />}>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-bold text-slate-700">BM名称</span>
                  <input className="min-h-[58px] w-full rounded-md border-2 border-slate-300 px-4 text-xl font-bold" value={bmForm.name} onChange={(event) => setBmForm({ ...bmForm, name: event.target.value })} />
                </label>
                <Field label="BM標高" suffix="m" value={bmForm.elevation} onChange={(value) => setBmForm({ ...bmForm, elevation: value })} />
                <Field label="後視値" suffix="m" value={bmForm.defaultBacksight} onChange={(value) => setBmForm({ ...bmForm, defaultBacksight: value })} />
              </div>
              <button className="mt-3 flex min-h-[54px] items-center gap-2 rounded-md bg-amber-600 px-5 font-black text-white" onClick={addBenchmark}>
                <Plus className="h-5 w-5" />
                BM登録
              </button>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.benchmarks.map((bm) => (
                  <div key={bm.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-lg font-black">{bm.name}</div>
                    <div className="text-sm font-bold text-slate-700">
                      標高 {bm.elevation.toFixed(3)} m / 後視 {bm.defaultBacksight.toFixed(3)} m
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="異常値閾値" icon={<AlertTriangle className="h-6 w-6 text-red-700" />}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="日沈下量閾値"
                  suffix="m"
                  min={0}
                  value={data.settings.abnormalDailySettlementThreshold}
                  onChange={(value) => setData((current) => ({ ...current, settings: { ...current.settings, abnormalDailySettlementThreshold: value } }))}
                />
                <Field
                  label="累積沈下量閾値"
                  suffix="m"
                  min={0}
                  value={data.settings.abnormalSettlementThreshold}
                  onChange={(value) => setData((current) => ({ ...current, settings: { ...current.settings, abnormalSettlementThreshold: value } }))}
                />
              </div>
            </Section>
          </div>
        ) : null}

        {activeTab === "export" ? (
          <div>
            <Section title="CSV / JSON出力" icon={<Download className="h-6 w-6 text-cyan-700" />}>
              <div className="grid gap-3 sm:grid-cols-3">
                <button className="flex min-h-[58px] items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 font-black text-white" onClick={exportAllCsv}>
                  <Download className="h-5 w-5" />
                  全履歴CSV
                </button>
                <button className="flex min-h-[58px] items-center justify-center gap-2 rounded-md bg-amber-600 px-4 font-black text-white" onClick={exportTodayCsv}>
                  <Download className="h-5 w-5" />
                  当日分CSV
                </button>
                <button className="flex min-h-[58px] items-center justify-center gap-2 rounded-md bg-slate-950 px-4 font-black text-white" onClick={exportJson}>
                  <FileJson className="h-5 w-5" />
                  JSON
                </button>
              </div>
            </Section>

            <Section title="CSV取込" icon={<Import className="h-6 w-6 text-amber-700" />}>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {[
                  { key: "append", label: "追記" },
                  { key: "overwrite", label: "上書き" }
                ].map((item) => (
                  <button
                    key={item.key}
                    className={`min-h-[52px] rounded-md border-2 font-black ${
                      importMode === item.key ? "border-amber-700 bg-amber-200 text-slate-950" : "border-slate-300 bg-white"
                    }`}
                    onClick={() => setImportMode(item.key as ImportMode)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-400 bg-slate-50 px-4 text-lg font-black text-slate-900">
                <Upload className="h-6 w-6" />
                CSVを選択
                <input className="hidden" type="file" accept=".csv,text/csv" onChange={importCsv} />
              </label>
            </Section>

            <Section title="観測履歴" icon={<ClipboardList className="h-6 w-6 text-slate-700" />}>
              <List observations={data.observations.slice(0, 12)} empty="観測データがありません" />
            </Section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function List({ observations, empty }: { observations: Observation[]; empty: string }) {
  if (!observations.length) {
    return <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">{empty}</div>;
  }

  return (
    <div className="grid gap-2">
      {observations.map((observation) => (
        <div key={observation.id} className="rounded-md border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-slate-950">
              {observation.measurementDate} {observation.routeName} {observation.stationName} {observation.position}
            </div>
            <div className="rounded-md bg-slate-100 px-2 py-1 text-sm font-black text-slate-800">
              沈下量 {observation.settlementAmount.toFixed(3)} m
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm font-bold text-slate-700 sm:grid-cols-4">
            <span>前視 {observation.foresight.toFixed(3)} m</span>
            <span>板標高 {observation.settlementPlateElevation.toFixed(3)} m</span>
            <span>日沈下 {observation.dailySettlementAmount.toFixed(3)} m</span>
            <span>BM {observation.bmName}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
