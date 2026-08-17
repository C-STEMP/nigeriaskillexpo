"use client";

import { useEffect, useState } from "react";
import { Select, Segmented, Table, Tag, Spin, Empty, Tabs } from "antd";
import Link from "next/link";

type Sector = { id: string; name: string };
type Trade = { id: string; name: string };
type Zone = { id: string; name: string; states: { id: string; name: string }[] };

type IndividualRow = {
  id: string;
  rank: number;
  applicantName: string;
  applicantCategory: string;
  tradeName: string;
  sectorName: string;
  stateName: string;
  zoneName: string;
  score: string | null;
  isPromoted: boolean;
};

type SectorResultRow = {
  id: string;
  rank: number | null;
  sectorTotal: string;
  isPromoted: boolean;
  state?: { name: string } | null;
  zone?: { name: string } | null;
};

function IndividualLeaderboard({ cycleId }: { cycleId: string | null }) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [stage, setStage] = useState<"State" | "Zonal" | "National">("National");
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  const [rows, setRows] = useState<IndividualRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/public/sectors").then((r) => r.json()).then((d) => setSectors(d.sectors ?? []));
    fetch("/api/public/zones").then((r) => r.json()).then((d) => setZones(d.zones ?? []));
  }, []);

  useEffect(() => {
    if (!sectorId) {
      setTrades([]);
      setTradeId(null);
      return;
    }
    fetch(`/api/public/trades?sectorId=${sectorId}`)
      .then((r) => r.json())
      .then((d) => setTrades(d.trades ?? []));
    setTradeId(null);
  }, [sectorId]);

  useEffect(() => {
    if (!cycleId || !sectorId || !tradeId) return;
    if (stage === "State" && !stateId) return;
    if (stage === "Zonal" && !zoneId) return;

    setLoading(true);
    const params = new URLSearchParams({ cycleId, sectorId, tradeId, stage });
    if (stage === "State" && stateId) params.set("stateId", stateId);
    if (stage === "Zonal" && zoneId) params.set("zoneId", zoneId);

    fetch(`/api/results/individuals?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRows(d.entries ?? []))
      .finally(() => setLoading(false));
  }, [cycleId, sectorId, tradeId, stage, stateId, zoneId]);

  const statesInSelectedZone = zones.find((z) => z.id === zoneId)?.states ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Select
          placeholder="Select a sector"
          className="w-full sm:w-56"
          options={sectors.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSectorId}
          value={sectorId}
        />
        <Select
          placeholder="Select a trade"
          className="w-full sm:w-56"
          disabled={!sectorId}
          options={trades.map((t) => ({ value: t.id, label: t.name }))}
          onChange={setTradeId}
          value={tradeId}
        />
        <Segmented
          value={stage}
          onChange={(v) => {
            setStage(v as typeof stage);
            setZoneId(null);
            setStateId(null);
          }}
          options={["State", "Zonal", "National"]}
        />
        {stage === "Zonal" && (
          <Select
            placeholder="Select a zone"
            className="w-full sm:w-56"
            options={zones.map((z) => ({ value: z.id, label: z.name }))}
            onChange={setZoneId}
            value={zoneId}
          />
        )}
        {stage === "State" && (
          <>
            <Select
              placeholder="Select a zone"
              className="w-full sm:w-48"
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
              onChange={(v) => {
                setZoneId(v);
                setStateId(null);
              }}
              value={zoneId}
            />
            <Select
              placeholder="Select a state"
              className="w-full sm:w-48"
              disabled={!zoneId}
              options={statesInSelectedZone.map((s) => ({ value: s.id, label: s.name }))}
              onChange={setStateId}
              value={stateId}
            />
          </>
        )}
      </div>

      {!sectorId || !tradeId || (stage === "State" && !stateId) || (stage === "Zonal" && !zoneId) ? (
        <Empty description="Select a sector and trade (and zone/state, if applicable) to view individual results" className="mt-16" />
      ) : loading ? (
        <div className="mt-16 flex justify-center">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <Empty description="No individual results published for this selection yet" className="mt-16" />
      ) : (
        <Table
          dataSource={rows}
          rowKey="id"
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            {
              title: "Rank",
              dataIndex: "rank",
              width: 70,
              render: (rank: number) => (
                <span className={rank <= 3 ? "font-bold text-primary" : "text-ink/70"}>{rank}</span>
              ),
            },
            {
              title: "Name",
              render: (_: unknown, row: IndividualRow) => (
                <span className={row.isPromoted ? "font-bold text-ink" : "text-ink/80"}>
                  {row.applicantName}
                </span>
              ),
            },
            { title: "Category", dataIndex: "applicantCategory", render: (v: string) => v.replace(/_/g, " ") },
            { title: "Trade", dataIndex: "tradeName" },
            { title: "Sector", dataIndex: "sectorName" },
            { title: "State", dataIndex: "stateName" },
            { title: "Zone", dataIndex: "zoneName" },
            {
              title: "Score",
              dataIndex: "score",
              render: (v: string | null) => (v ? Number(v).toFixed(2) : "—"),
            },
            {
              title: "",
              render: (_: unknown, row: IndividualRow) =>
                row.isPromoted ? <Tag color="gold">Advanced</Tag> : null,
            },
          ]}
        />
      )}
    </div>
  );
}

function SectorAggregateView({ cycleId }: { cycleId: string | null }) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [stage, setStage] = useState<"State" | "Zonal" | "National">("National");
  const [results, setResults] = useState<SectorResultRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/public/sectors").then((r) => r.json()).then((d) => setSectors(d.sectors ?? []));
  }, []);

  useEffect(() => {
    if (!sectorId || !cycleId) return;
    setLoading(true);
    fetch(`/api/results/public?cycleId=${cycleId}&sectorId=${sectorId}&stage=${stage}`)
      .then((r) => r.json())
      .then((data) => setResults(data.results ?? []))
      .finally(() => setLoading(false));
  }, [sectorId, stage, cycleId]);

  const locationLabel = (row: SectorResultRow) =>
    stage === "National" ? row.zone?.name ?? "—" : row.state?.name ?? "—";

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Select
          placeholder="Select a sector"
          className="w-full sm:w-72"
          options={sectors.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSectorId}
          value={sectorId}
        />
        <Segmented
          value={stage}
          onChange={(v) => setStage(v as typeof stage)}
          options={["State", "Zonal", "National"]}
        />
      </div>

      {!sectorId ? (
        <Empty description="Select a sector to view results" className="mt-16" />
      ) : loading ? (
        <div className="mt-16 flex justify-center">
          <Spin />
        </div>
      ) : results.length === 0 ? (
        <Empty description="No results published for this stage yet" className="mt-16" />
      ) : (
        <Table
          dataSource={results}
          rowKey="id"
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            {
              title: "Rank",
              dataIndex: "rank",
              width: 80,
              render: (rank: number) => (
                <span className={rank <= 3 ? "font-bold text-primary" : "text-ink/70"}>{rank}</span>
              ),
            },
            {
              title: stage === "National" ? "Zone" : "State",
              render: (_: unknown, row: SectorResultRow) => (
                <span className={row.isPromoted ? "font-bold text-ink" : "text-ink/80"}>
                  {locationLabel(row)}
                </span>
              ),
            },
            {
              title: "Score",
              dataIndex: "sectorTotal",
              render: (val: string, row: SectorResultRow) => (
                <span className={row.isPromoted ? "font-bold text-ink" : "text-ink/80"}>
                  {Number(val).toFixed(2)}
                </span>
              ),
            },
            {
              title: "",
              render: (_: unknown, row: SectorResultRow) =>
                row.isPromoted ? <Tag color="gold" className="!rounded-full">Advanced</Tag> : null,
            },
          ]}
        />
      )}
    </div>
  );
}

export default function PublicResultsPage() {
  const [cycleId, setCycleId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/active-cycle")
      .then((r) => r.json())
      .then((data) => setCycleId(data.cycle?.id ?? null));
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-grey px-6 py-5 text-center">
        <Link href="/" className="font-display text-2xl font-bold text-primary hover:opacity-80 cursor-pointer">
          Nigeria Skills Expo
        </Link>
        <h1 className="mt-1 font-display text-lg text-ink/80">
          Skills Excellence Awards — Public Results
        </h1>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Tabs
          centered
          items={[
            {
              key: "individuals",
              label: "Individual Results",
              children: <IndividualLeaderboard cycleId={cycleId} />,
            },
            {
              key: "sectors",
              label: "Sector Overview",
              children: <SectorAggregateView cycleId={cycleId} />,
            },
          ]}
        />
      </main>

      <footer className="border-t border-grey px-6 py-4 text-center text-xs text-ink/40">
        © {new Date().getFullYear()} Nigeria Skills Expo. All results are published for public transparency.
      </footer>
    </div>
  );
}
