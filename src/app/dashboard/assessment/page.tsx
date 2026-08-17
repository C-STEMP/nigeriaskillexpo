"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Select, Tag, Space, Progress } from "antd";
import Link from "next/link";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Entry = {
  id: string;
  trade: { name: string };
  sector: { name: string };
  state: { name: string; zone: { name: string } };
  currentLevel: string;
  tradeTotal: string | null;
  panel: { completedAt: string | null }[];
};
type Sector = { id: string; name: string };
type Zone = { id: string; name: string };

export default function AssessmentMonitorPage() {
  const [sectorId, setSectorId] = useState<string | undefined>(undefined);
  const [zoneId, setZoneId] = useState<string | undefined>(undefined);

  const { data: sectorsData } = useSWR<{ sectors: Sector[] }>("/api/public/sectors", fetcher);
  const { data: zonesData } = useSWR<{ zones: Zone[] }>("/api/public/zones", fetcher);

  const params = new URLSearchParams();
  if (sectorId) params.set("sectorId", sectorId);
  if (zoneId) params.set("zoneId", zoneId);
  const { data: entriesData, isLoading } = useSWR<{ entries: Entry[] }>(
    `/api/zonal/state-trade-entries?${params.toString()}`,
    fetcher
  );

  const sectors = sectorsData?.sectors ?? [];
  const zones = zonesData?.zones ?? [];
  const entries = entriesData?.entries ?? [];

  function progressPct(entry: Entry) {
    if (entry.panel.length === 0) return 0;
    const completed = entry.panel.filter((p) => p.completedAt).length;
    return Math.round((completed / entry.panel.length) * 100);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment"
        subtitle="Live progress across every trade entry — panel completion and current totals."
      />

      <Space wrap>
        <Select
          placeholder="Sector"
          allowClear
          className="w-56"
          options={sectors.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSectorId}
        />
        <Select
          placeholder="Zone"
          allowClear
          className="w-56"
          options={zones.map((z) => ({ value: z.id, label: z.name }))}
          onChange={setZoneId}
        />
      </Space>

      <TableWrapper>
        <Table
          dataSource={entries}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            { title: "Trade", dataIndex: ["trade", "name"] },
            { title: "Sector", dataIndex: ["sector", "name"] },
            { title: "State", dataIndex: ["state", "name"] },
            { title: "Zone", render: (_: unknown, e: Entry) => e.state.zone.name },
            {
              title: "Level",
              dataIndex: "currentLevel",
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: "Panel progress",
              render: (_: unknown, e: Entry) =>
                e.panel.length === 0 ? (
                  <Tag color="gold">No panel</Tag>
                ) : (
                  <Progress percent={progressPct(e)} size="small" />
                ),
            },
            {
              title: "Trade total",
              dataIndex: "tradeTotal",
              render: (v: string | null) => (v ? Number(v).toFixed(2) : "—"),
            },
            {
              title: "",
              render: (_: unknown, e: Entry) => (
                <Link
                  href={`/dashboard/entries/${e.id}`}
                  className="cursor-pointer text-sm text-primary hover:underline"
                >
                  View
                </Link>
              ),
            },
          ]}
        />
      </TableWrapper>
    </div>
  );
}
