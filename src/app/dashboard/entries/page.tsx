"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Table, Tag, Button, Modal, Form, Select, Alert } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { fetcher } from "@/lib/fetcher";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Entry = {
  id: string;
  trade: { name: string };
  sector: { name: string };
  state: { name: string };
  applicant: {
    firstName: string | null;
    lastName: string | null;
    organizationName: string | null;
  };
  panel: { completedAt: string | null }[];
};
type Sector = { id: string; name: string };
type Trade = { id: string; name: string };
type Zone = { id: string; name: string; states: { id: string; name: string }[] };
type EligibleApplicant = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string | null;
  applicantCategory: string;
};
type Cycle = { id: string; year: number; title: string };

function applicantName(a: Entry["applicant"]) {
  return a.organizationName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
}

export default function EntriesPage() {
  // The API route already scopes results correctly per role:
  // - Zonal_Admin sees all entries in their zone
  // - State_Assessor/Moderator see entries in their state
  // - Assessors/Moderators generally see only entries where they are on the panel
  const { data, isLoading, mutate } = useSWR<{ entries: Entry[] }>("/api/zonal/state-trade-entries", fetcher);
  const entries = data?.entries ?? [];

  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string | null>(null);

  const { data: cyclesData } = useSWR<{ cycles: Cycle[] }>(addOpen ? "/api/admin/cycles" : null, fetcher);
  const { data: sectorsData } = useSWR<{ sectors: Sector[] }>(addOpen ? "/api/public/sectors" : null, fetcher);
  const { data: zonesData } = useSWR<{ zones: Zone[] }>(addOpen ? "/api/public/zones" : null, fetcher);
  const { data: tradesData } = useSWR<{ trades: Trade[] }>(
    sectorId ? `/api/public/trades?sectorId=${sectorId}` : null,
    fetcher
  );
  const cycles = cyclesData?.cycles ?? [];
  const sectors = sectorsData?.sectors ?? [];
  const zones = zonesData?.zones ?? [];
  const trades = tradesData?.trades ?? [];
  const statesInZone = zones.find((z) => z.id === zoneId)?.states ?? [];

  const currentCycleId = cycles[0]?.id ?? null;
  const { data: eligibleData } = useSWR<{ applicants: EligibleApplicant[] }>(
    currentCycleId && tradeId && stateId
      ? `/api/admin/eligible-applicants?cycleId=${currentCycleId}&tradeId=${tradeId}&stateId=${stateId}`
      : null,
    fetcher
  );
  const eligibleApplicants = eligibleData?.applicants ?? [];

  function resetAddForm() {
    form.resetFields();
    setSectorId(null);
    setZoneId(null);
    setTradeId(null);
    setStateId(null);
    setError(null);
  }

  async function handleAdd(values: { applicantId: string }) {
    if (!currentCycleId || !sectorId || !stateId || !tradeId) {
      setError("Select a cycle, sector, zone, state, and trade first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/zonal/state-trade-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: currentCycleId,
          sectorId,
          stateId,
          tradeId,
          applicantId: values.applicantId,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setError(resData.error ?? "Could not create entry.");
        return;
      }
      setAddOpen(false);
      resetAddForm();
      mutate();
    } finally {
      setSubmitting(false);
    }
  }

  const columns = [
    {
      title: "Applicant",
      key: "applicant",
      render: (_: unknown, row: Entry) => applicantName(row.applicant),
    },
    { title: "Trade", dataIndex: ["trade", "name"] as string[] },
    { title: "Sector", dataIndex: ["sector", "name"] as string[] },
    { title: "State", dataIndex: ["state", "name"] as string[] },
    {
      title: "Panel",
      key: "panel",
      render: (_: unknown, row: Entry) =>
        row.panel.length === 0 ? (
          <Tag color="gold">No panel</Tag>
        ) : (
          <Tag color={row.panel.every((p) => p.completedAt) ? "green" : "blue"}>
            {row.panel.filter((p) => p.completedAt).length}/{row.panel.length} done
          </Tag>
        ),
    },
    {
      title: "",
      key: "action",
      render: (_: unknown, row: Entry) => (
        <Link
          href={`/dashboard/entries/${row.id}`}
          className="cursor-pointer text-sm text-primary hover:underline"
        >
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entries"
        subtitle="Individual applicants being assessed in your zone, state, or assigned to your panel."
        action={
          <Button type="primary" icon={<PlusOutlined />} className="cursor-pointer" onClick={() => setAddOpen(true)}>
            Add entry
          </Button>
        }
      />
      <TableWrapper>
        <Table
          dataSource={entries}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={columns}
        />
      </TableWrapper>

      <Modal
        title="Add entry — assess an applicant"
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          resetAddForm();
        }}
        onOk={() => form.submit()}
        okText="Add entry"
        confirmLoading={submitting}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}
        <Form form={form} layout="vertical" onFinish={handleAdd} requiredMark={false}>
          <Form.Item label="Sector" required>
            <Select
              placeholder="Select sector"
              value={sectorId}
              onChange={(v) => {
                setSectorId(v);
                setTradeId(null);
              }}
              options={sectors.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item label="Trade" required extra="Only trades under the selected sector.">
            <Select
              placeholder="Select trade"
              disabled={!sectorId}
              value={tradeId}
              onChange={setTradeId}
              options={trades.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Form.Item>
          <Form.Item label="Zone" required>
            <Select
              placeholder="Select zone"
              value={zoneId}
              onChange={(v) => {
                setZoneId(v);
                setStateId(null);
              }}
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
            />
          </Form.Item>
          <Form.Item label="State" required>
            <Select
              placeholder="Select state"
              disabled={!zoneId}
              value={stateId}
              onChange={setStateId}
              options={statesInZone.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item
            label="Applicant"
            name="applicantId"
            rules={[{ required: true, message: "Select the applicant to assess." }]}
            extra="Only applicants registered for this trade and state, not already entered, are listed."
          >
            <Select
              placeholder={
                tradeId && stateId
                  ? eligibleApplicants.length
                    ? "Select applicant"
                    : "No eligible applicants found for this trade/state"
                  : "Select a trade and state first"
              }
              disabled={!tradeId || !stateId}
              options={eligibleApplicants.map((a) => ({
                value: a.id,
                label: `${a.organizationName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()} (${a.applicantCategory.replace(/_/g, " ")})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
