"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Alert,
  Switch,
  Tabs,
  Popconfirm,
} from "antd";
import { PlusOutlined, LockOutlined, UnlockOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Sector = { id: string; name: string };
type Trade = { id: string; name: string };
type Cycle = { id: string; year: number; title: string };
type Criterion = {
  id: string;
  text: string;
  maxScore: string;
  scope: string;
  level: string;
  status: string;
  sector: Sector | null;
  trade: Trade | null;
};
type Lock = { id: string; level: string; sectorScopeKey: string; state: string; sector: Sector | null };

const SCOPE_OPTIONS = [
  { value: "Global_AllTrades", label: "Global — all trades, every sector" },
  { value: "Global_PerSector", label: "Global — applies to all sectors generally" },
  { value: "Sector_Wide", label: "Sector-wide — one sector, every trade under it" },
  { value: "Trade_Specific", label: "Trade-specific — one exact trade" },
];

const LEVEL_OPTIONS = [
  { value: "State_Only", label: "State stage only" },
  { value: "Zonal_Only", label: "Zonal stage only" },
  { value: "National_Only", label: "National stage only" },
  { value: "Nationwide", label: "Nationwide (usable at all stages)" },
];

const EVIDENCE_OPTIONS = [
  "Certificates", "Portfolios", "Employment_Records", "Business_Registration_Documents",
  "Business_Performance_Records", "Project_Photographs", "Videos", "References", "Testimonials",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const ASSESSMENT_LEVELS = ["State", "Zonal", "National"] as const;

export default function CriteriaPage() {
  const { data: cyclesData } = useSWR<{ cycles: Cycle[] }>("/api/admin/cycles", fetcher);
  const { data: sectorsData } = useSWR<{ sectors: Sector[] }>("/api/admin/sectors", fetcher);
  const cycles = cyclesData?.cycles ?? [];
  const sectors = sectorsData?.sectors ?? [];

  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedCycle && cycles[0]) setSelectedCycle(cycles[0].id);
  }, [cycles, selectedCycle]);

  const { data: criteriaData, mutate: mutateCriteria } = useSWR<{ criteria: Criterion[] }>(
    selectedCycle ? `/api/admin/criteria?cycleId=${selectedCycle}` : null,
    fetcher
  );
  const { data: locksData, mutate: mutateLocks } = useSWR<{ locks: Lock[] }>(
    selectedCycle ? `/api/admin/criteria/locks?cycleId=${selectedCycle}` : null,
    fetcher
  );
  const criteria = criteriaData?.criteria ?? [];
  const locks = locksData?.locks ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Criterion | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const [scopeSectorId, setScopeSectorId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [error, setError] = useState<string | null>(null);

  const { data: tradesData } = useSWR<{ trades: Trade[] }>(
    scopeSectorId ? `/api/admin/trades?sectorId=${scopeSectorId}` : null,
    fetcher
  );
  const trades = tradesData?.trades ?? [];

  async function handleCreate(values: Record<string, unknown>) {
    if (!selectedCycle) return;
    setError(null);
    const res = await fetch("/api/admin/criteria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, cycleId: selectedCycle }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create criterion.");
      return;
    }
    setCreateOpen(false);
    form.resetFields();
    setScope(null);
    setScopeSectorId(null);
    mutateCriteria();
  }

  function openEdit(criterion: Criterion) {
    setEditTarget(criterion);
    editForm.setFieldsValue({
      text: criterion.text,
      maxScore: Number(criterion.maxScore),
    });
  }

  async function handleEdit(values: { text: string; maxScore: number }) {
    if (!editTarget) return;
    setError(null);
    const res = await fetch(`/api/admin/criteria/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not update criterion. It may already have scores recorded.");
      return;
    }
    setEditTarget(null);
    editForm.resetFields();
    mutateCriteria();
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/criteria/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not delete criterion. It may already have scores recorded — set it to Retired instead.");
      return;
    }
    mutateCriteria();
  }

  async function handleActivate(criterion: Criterion) {
    await fetch(`/api/admin/criteria/${criterion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: criterion.status === "Active" ? "Draft" : "Active" }),
    });
    mutateCriteria();
  }

  async function toggleLock(level: (typeof ASSESSMENT_LEVELS)[number], sectorId?: string) {
    if (!selectedCycle) return;
    const sectorScopeKey = sectorId ?? "ALL_SECTORS";
    const existing = locks.find((l) => l.level === level && l.sectorScopeKey === sectorScopeKey);
    const action = existing?.state === "Locked" ? "unlock" : "lock";
    await fetch("/api/admin/criteria/locks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId: selectedCycle, level, sectorId, action }),
    });
    mutateLocks();
  }

  const wholeLevelLock = (level: (typeof ASSESSMENT_LEVELS)[number]) =>
    locks.find((l) => l.level === level && l.sectorScopeKey === "ALL_SECTORS");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Criteria"
        subtitle="Define what's being assessed, and lock scoring when a stage concludes."
        action={
          <>
            <Select
              value={selectedCycle}
              onChange={setSelectedCycle}
              className="w-56"
              options={cycles.map((c) => ({ value: c.id, label: c.title }))}
            />
            <Button type="primary" icon={<PlusOutlined />} className="cursor-pointer" onClick={() => setCreateOpen(true)}>
              New criterion
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3">
        {ASSESSMENT_LEVELS.map((level) => {
          const lock = wholeLevelLock(level);
          const isLocked = lock?.state === "Locked";
          return (
            <Button
              key={level}
              danger={isLocked}
              className="cursor-pointer"
              icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => toggleLock(level)}
            >
              {isLocked ? `Unlock ${level} scoring` : `Lock ${level} scoring`} (all sectors)
            </Button>
          );
        })}
      </div>

      {error && (
        <Alert type="error" showIcon title={error} closable={{ onClose: () => setError(null) }} className="rounded-lg" />
      )}

      <Tabs
        items={[
          {
            key: "criteria",
            label: "Criteria",
            children: (
              <TableWrapper>
                <Table
                  dataSource={criteria}
                  rowKey="id"
                  pagination={{ pageSize: 40, hideOnSinglePage: true }}
                  columns={[
                    { title: "Question / requirement", dataIndex: "text", width: 320 },
                    {
                      title: "Scope",
                      render: (_: unknown, c: Criterion) => (
                        <span className="text-xs">
                          {c.scope.replace(/_/g, " ")}
                          {c.sector && ` · ${c.sector.name}`}
                          {c.trade && ` · ${c.trade.name}`}
                        </span>
                      ),
                    },
                    { title: "Level", dataIndex: "level", render: (v: string) => v.replace(/_/g, " ") },
                    { title: "Max score", dataIndex: "maxScore" },
                    {
                      title: "Status",
                      render: (_: unknown, c: Criterion) => (
                        <Switch
                          checked={c.status === "Active"}
                          checkedChildren="Active"
                          unCheckedChildren="Draft"
                          className="cursor-pointer"
                          onChange={() => handleActivate(c)}
                        />
                      ),
                    },
                    {
                      title: "",
                      render: (_: unknown, c: Criterion) => (
                        <div className="flex gap-2">
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            className="cursor-pointer"
                            onClick={() => openEdit(c)}
                          />
                          <Popconfirm
                            title="Delete this criterion?"
                            description="Only possible if no scores have been recorded against it yet."
                            onConfirm={() => handleDelete(c.id)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} className="cursor-pointer" />
                          </Popconfirm>
                        </div>
                      ),
                    },
                  ]}
                />
              </TableWrapper>
            ),
          },
          {
            key: "locks",
            label: "Sector-specific locks",
            children: (
              <TableWrapper>
                <Table
                  dataSource={sectors}
                  rowKey="id"
                  pagination={{ pageSize: 40, hideOnSinglePage: true }}
                  columns={[
                    { title: "Sector", dataIndex: "name" },
                    ...ASSESSMENT_LEVELS.map((level) => ({
                      title: level,
                      key: level,
                      render: (_: unknown, s: Sector) => {
                        const lock = locks.find((l) => l.level === level && l.sectorScopeKey === s.id);
                        const isLocked = lock?.state === "Locked";
                        return (
                          <Tag
                            color={isLocked ? "red" : "green"}
                            className="cursor-pointer"
                            onClick={() => toggleLock(level, s.id)}
                          >
                            {isLocked ? "Locked" : "Open"}
                          </Tag>
                        );
                      },
                    })),
                  ]}
                />
              </TableWrapper>
            ),
          },
        ]}
      />

      {/* Create modal */}
      <Modal
        title="New criterion"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="Create"
        width={600}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item label="Question / requirement" name="text" rules={[{ required: true, message: "This field is required." }]}>
            <Input.TextArea rows={2} placeholder="e.g. Provide evidence of completed apprenticeship" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item label="Max score" name="maxScore" rules={[{ required: true, message: "Required." }]}>
              <InputNumber min={1} max={1000} className="w-full" />
            </Form.Item>
            <Form.Item label="Assessment level" name="level" rules={[{ required: true, message: "Required." }]} initialValue="Nationwide">
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>
          </div>
          <Form.Item label="Scope" name="scope" rules={[{ required: true, message: "Required." }]}>
            <Select options={SCOPE_OPTIONS} onChange={setScope} />
          </Form.Item>
          {(scope === "Sector_Wide" || scope === "Trade_Specific") && (
            <Form.Item label="Sector" name="sectorId" rules={[{ required: true, message: "Required for this scope." }]}>
              <Select options={sectors.map((s) => ({ value: s.id, label: s.name }))} onChange={setScopeSectorId} />
            </Form.Item>
          )}
          {scope === "Trade_Specific" && (
            <Form.Item label="Trade" name="tradeId" rules={[{ required: true, message: "Required for this scope." }]}>
              <Select options={trades.map((t) => ({ value: t.id, label: t.name }))} />
            </Form.Item>
          )}
          <Form.Item label="Allowed evidence types" name="allowedEvidenceTypes" rules={[{ required: true, message: "Select at least one." }]}>
            <Select mode="multiple" options={EVIDENCE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal
        title="Edit criterion"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save changes"
        width={600}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
          <Form.Item label="Question / requirement" name="text" rules={[{ required: true, message: "This field is required." }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Max score"
            name="maxScore"
            rules={[{ required: true, message: "Required." }]}
            extra="Cannot be changed once scores have been recorded against this criterion."
          >
            <InputNumber min={1} max={1000} className="w-full" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
