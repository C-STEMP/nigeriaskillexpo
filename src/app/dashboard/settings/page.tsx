"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Alert } from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TableWrapper } from "@/components/ui/table-wrapper";

type Sector = { id: string; name: string };
type Cycle = {
  id: string;
  year: number;
  title: string;
  status: string;
  sectorOfferings: { sector: Sector }[];
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "default",
  Open: "green",
  Registration_Closed: "orange",
  Zonal_Locked: "red",
  National_Locked: "red",
  Archived: "default",
};

const STATUS_OPTIONS = [
  "Draft",
  "Open",
  "Registration_Closed",
  "Zonal_Locked",
  "National_Locked",
  "Archived",
];

export default function CycleSettingsPage() {
  const { data: cyclesData, isLoading, mutate: mutateCycles } = useSWR<{ cycles: Cycle[] }>(
    "/api/admin/cycles",
    fetcher
  );
  const { data: sectorsData } = useSWR<{ sectors: Sector[] }>("/api/admin/sectors", fetcher);
  const cycles = cyclesData?.cycles ?? [];
  const sectors = sectorsData?.sectors ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cycle | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function openEdit(cycle: Cycle) {
    setEditTarget(cycle);
    editForm.setFieldsValue({
      title: cycle.title,
      status: cycle.status,
      sectorIds: cycle.sectorOfferings.map((o) => o.sector.id),
    });
  }

  async function handleCreate(values: { year: number; title: string; sectorIds: string[] }) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not create cycle."); return; }
      setCreateOpen(false);
      form.resetFields();
      mutateCycles();
    } finally { setSubmitting(false); }
  }

  async function handleEdit(values: { title: string; status: string; sectorIds: string[] }) {
    if (!editTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cycles/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not update cycle."); return; }
      setEditTarget(null);
      editForm.resetFields();
      mutateCycles();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Settings"
        subtitle="Create or edit competition cycles. Setting a cycle to Open opens public registration."
        action={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New cycle
          </Button>
        }
      />

      {error && (
        <Alert type="error" showIcon title={error} closable={{ onClose: () => setError(null) }} className="rounded-lg" />
      )}

      <TableWrapper>
        <Table
          dataSource={cycles}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          className="rounded-xl"
          columns={[
            { title: "Year", dataIndex: "year", width: 80 },
            { title: "Title", dataIndex: "title" },
            {
              title: "Sectors offered",
              render: (_: unknown, row: Cycle) => (
                <span className="text-sm text-ink/60">{row.sectorOfferings.length} sectors</span>
              ),
            },
            {
              title: "Status",
              render: (_: unknown, row: Cycle) => (
                <Tag color={STATUS_COLORS[row.status]}>{row.status.replace(/_/g, " ")}</Tag>
              ),
            },
            {
              title: "",
              render: (_: unknown, row: Cycle) => (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(row)}
                  className="cursor-pointer"
                >
                  Edit
                </Button>
              ),
            },
          ]}
        />
      </TableWrapper>

      {/* Create modal */}
      <Modal
        title="New competition cycle"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="Create cycle"
        confirmLoading={submitting}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item label="Year" name="year" rules={[{ required: true }]}>
            <InputNumber className="w-full" min={2020} max={2100} />
          </Form.Item>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Nigeria Skills Expo 2027 Skills Excellence Awards" />
          </Form.Item>
          <Form.Item label="Sectors offered this cycle" name="sectorIds">
            <Select mode="multiple" placeholder="Select sectors" options={sectors.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal
        title={editTarget ? `Edit — ${editTarget.title}` : ""}
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={() => editForm.submit()}
        okText="Save changes"
        confirmLoading={submitting}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
          <Form.Item label="Title" name="title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Status" name="status">
            <Select options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))} />
          </Form.Item>
          <Form.Item label="Sectors offered" name="sectorIds">
            <Select mode="multiple" options={sectors.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
