"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Select, Segmented, Table, Tag, Button, Alert, Space } from "antd";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Sector = { id: string; name: string };
type Zone = { id: string; name: string; states: { id: string; name: string }[] };
type Cycle = { id: string; year: number; title: string };
type SectorResultRow = {
  id: string;
  rank: number | null;
  sectorTotal: string;
  isPromoted: boolean;
  state?: { name: string } | null;
  zone?: { name: string } | null;
};

export default function ResultsPage() {
  const { data: cyclesData } = useSWR<{ cycles: Cycle[] }>("/api/admin/cycles", fetcher);
  const { data: sectorsData } = useSWR<{ sectors: Sector[] }>("/api/admin/sectors", fetcher);
  const { data: zonesData } = useSWR<{ zones: Zone[] }>("/api/public/zones", fetcher);
  const cycles = cyclesData?.cycles ?? [];
  const sectors = sectorsData?.sectors ?? [];
  const zones = zonesData?.zones ?? [];

  const [cycleId, setCycleId] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);
  const [stage, setStage] = useState<"State" | "Zonal" | "National">("Zonal");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Default cycle selection once cycles load
  if (!cycleId && cycles[0]) setCycleId(cycles[0].id);

  const { data: resultsData, isLoading, mutate } = useSWR<{ results: SectorResultRow[] }>(
    cycleId && sectorId
      ? `/api/results/public?cycleId=${cycleId}&sectorId=${sectorId}&stage=${stage}`
      : null,
    fetcher
  );
  const results = resultsData?.results ?? [];

  const statesInSelectedZone = zones.find((z) => z.id === zoneId)?.states ?? [];

  async function handleComputeState() {
    if (!cycleId || !sectorId || !stateId) {
      setActionError("Select a cycle, sector, zone, and state first.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/results/compute-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, sectorId, stateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not compute state result.");
        return;
      }
      setActionSuccess("State-level sector result computed.");
      mutate();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComputeZonal() {
    if (!cycleId || !sectorId || !zoneId) {
      setActionError("Select a cycle, sector, and zone first.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/results/compute-zonal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, sectorId, zoneId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not compute zonal result.");
        return;
      }
      setActionSuccess("Zonal-level sector result computed (includes any zonal-stage scores submitted so far).");
      mutate();
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePromoteZonal() {
    if (!cycleId || !sectorId || !zoneId) {
      setActionError("Select a cycle, sector, and zone first.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/results/promote-zonal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, sectorId, zoneId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not promote.");
        return;
      }
      setActionSuccess(`Promoted ${data.promoted.length} state result(s) to the zonal stage.`);
      mutate();
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePromoteNational() {
    if (!cycleId || !sectorId) {
      setActionError("Select a cycle and sector first.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/results/promote-national", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, sectorId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not promote.");
        return;
      }
      setActionSuccess(`Promoted ${data.promoted.length} zonal result(s) to the national stage.`);
      mutate();
    } finally {
      setActionLoading(false);
    }
  }

  const locationLabel = (row: SectorResultRow) =>
    stage === "National" ? row.zone?.name ?? "—" : row.state?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Results & Promotion"
        subtitle="Full transparency — the entire ranked list is visible, with the top 3 highlighted."
      />

      <Space wrap>
        <Select
          placeholder="Cycle"
          className="w-56"
          value={cycleId}
          onChange={setCycleId}
          options={cycles.map((c) => ({ value: c.id, label: c.title }))}
        />
        <Select
          placeholder="Sector"
          className="w-56"
          value={sectorId}
          onChange={setSectorId}
          options={sectors.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Select
          placeholder="Zone"
          className="w-56"
          value={zoneId}
          onChange={(v) => { setZoneId(v); setStateId(null); }}
          options={zones.map((z) => ({ value: z.id, label: z.name }))}
        />
        <Select
          placeholder="State (for computing state results)"
          className="w-64"
          value={stateId}
          onChange={setStateId}
          disabled={!zoneId}
          options={statesInSelectedZone.map((s) => ({ value: s.id, label: s.name }))}
        />
        <Segmented
          value={stage}
          onChange={(v) => setStage(v as typeof stage)}
          options={["State", "Zonal", "National"]}
        />
      </Space>

      {actionError && (
        <Alert type="error" showIcon title={actionError} closable={{ onClose: () => setActionError(null) }} className="rounded-lg" />
      )}
      {actionSuccess && (
        <Alert type="success" showIcon title={actionSuccess} closable={{ onClose: () => setActionSuccess(null) }} className="rounded-lg" />
      )}

      <Space wrap>
        <Button className="cursor-pointer" loading={actionLoading} onClick={handleComputeState}>
          Compute State result
        </Button>
        <Button className="cursor-pointer" loading={actionLoading} onClick={handleComputeZonal}>
          Compute Zonal result
        </Button>
        <Button type="primary" loading={actionLoading} className="cursor-pointer" onClick={handlePromoteZonal}>
          Promote State → Zonal
        </Button>
        <Button type="primary" loading={actionLoading} className="cursor-pointer" onClick={handlePromoteNational}>
          Promote Zonal → National
        </Button>
      </Space>

      <TableWrapper>
        <Table
          dataSource={results}
          rowKey="id"
          loading={isLoading}
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
              render: (val: string) => Number(val).toFixed(2),
            },
            {
              title: "",
              render: (_: unknown, row: SectorResultRow) =>
                row.isPromoted ? <Tag color="gold">Advanced</Tag> : null,
            },
          ]}
        />
      </TableWrapper>
    </div>
  );
}
