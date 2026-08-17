"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Button, Modal, Form, Input, Select, Tag, Alert, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type AwardCategory = {
  id: string;
  name: string;
  description: string | null;
  requiredEntityType: string;
  results: { id: string }[];
};
type Cycle = { id: string; year: number; title: string };
type Sector = { id: string; name: string };
type SectorResultRow = { id: string; sectorTotal: string; sector: Sector; zone?: { name: string } | null };

const ENTITY_OPTIONS = [
  { value: "Trainee", label: "Trainee" },
  { value: "TSP", label: "Training Service Provider" },
  { value: "Technical_College", label: "Technical College" },
  { value: "Instructor", label: "Instructor" },
  { value: "Industry_Partner", label: "Industry Partner" },
  { value: "Cross_Category", label: "Cross-category (multiple entity types)" },
];

export default function AwardsPage() {
  const { data: catData, mutate: mutateCategories } = useSWR<{ categories: AwardCategory[] }>(
    "/api/admin/award-categories",
    fetcher
  );
  const { data: cycleData } = useSWR<{ cycles: Cycle[] }>("/api/admin/cycles", fetcher);
  const { data: sectorData } = useSWR<{ sectors: Sector[] }>("/api/admin/sectors", fetcher);
  const categories = catData?.categories ?? [];
  const cycles = cycleData?.cycles ?? [];
  const sectors = sectorData?.sectors ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AwardCategory | null>(null);
  const [assignCategory, setAssignCategory] = useState<AwardCategory | null>(null);
  const [assignCycle, setAssignCycle] = useState<string | null>(null);
  const [assignSector, setAssignSector] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [error, setError] = useState<string | null>(null);

  const { data: resultsData } = useSWR<{ results: SectorResultRow[] }>(
    assignCycle && assignSector
      ? `/api/results/public?cycleId=${assignCycle}&sectorId=${assignSector}&stage=National`
      : null,
    fetcher
  );
  const nationalResults = resultsData?.results ?? [];

  async function handleCreate(values: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/admin/award-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Could not create award category."); return; }
    setCreateOpen(false);
    form.resetFields();
    mutateCategories();
  }

  function openEdit(category: AwardCategory) {
    setEditTarget(category);
    editForm.setFieldsValue({
      name: category.name,
      description: category.description,
      requiredEntityType: category.requiredEntityType,
    });
  }

  async function handleEdit(values: Record<string, unknown>) {
    if (!editTarget) return;
    setError(null);
    const res = await fetch(`/api/admin/award-categories/${editTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Could not update award category."); return; }
    setEditTarget(null);
    mutateCategories();
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/award-categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Could not delete award category."); return; }
    mutateCategories();
  }

  async function handleAssign(values: { sectorResultId: string }) {
    if (!assignCategory || !assignCycle) return;
    setError(null);
    const res = await fetch(`/api/admin/award-categories/${assignCategory.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId: assignCycle, sectorResultId: values.sectorResultId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Could not assign award."); return; }
    setAssignCategory(null);
    assignForm.resetFields();
    mutateCategories();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Award Categories"
        subtitle="Manage the award categories. Not every category needs to be decided every cycle — only those whose required entity type has real data."
        action={
          <Button type="primary" icon={<PlusOutlined />} className="cursor-pointer" onClick={() => setCreateOpen(true)}>
            New category
          </Button>
        }
      />

      {error && (
        <Alert type="error" showIcon title={error} closable={{ onClose: () => setError(null) }} className="rounded-lg" />
      )}

      <TableWrapper>
        <Table
          dataSource={categories}
          rowKey="id"
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            { title: "Award category", dataIndex: "name" },
            {
              title: "Requires",
              dataIndex: "requiredEntityType",
              render: (v: string) => <Tag>{v.replace(/_/g, " ")}</Tag>,
            },
            {
              title: "Decided this cycle?",
              render: (_: unknown, c: AwardCategory) =>
                c.results.length > 0 ? <Tag color="green">Yes</Tag> : <Tag>Not yet</Tag>,
            },
            {
              title: "",
              render: (_: unknown, c: AwardCategory) => (
                <div className="flex flex-wrap gap-2">
                  <Button size="small" className="cursor-pointer" onClick={() => setAssignCategory(c)}>
                    Assign result
                  </Button>
                  <Button size="small" icon={<EditOutlined />} className="cursor-pointer" onClick={() => openEdit(c)} />
                  <Popconfirm
                    title="Delete this award category?"
                    description="Only possible if it has not been assigned to a result yet."
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

      {/* Create modal */}
      <Modal title="New award category" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create">
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Required." }]}>
            <Input placeholder="e.g. Outstanding Skills Graduate Award" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            label="Required entity type"
            name="requiredEntityType"
            rules={[{ required: true, message: "Required." }]}
            extra="If this entity type has no data on the platform for a cycle, this category simply won't be decided that year."
          >
            <Select options={ENTITY_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal title={editTarget ? `Edit — ${editTarget.name}` : ""} open={!!editTarget} onCancel={() => setEditTarget(null)} onOk={() => editForm.submit()} okText="Save changes">
        <Form form={editForm} layout="vertical" onFinish={handleEdit} requiredMark={false}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Required." }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Required entity type" name="requiredEntityType" rules={[{ required: true, message: "Required." }]}>
            <Select options={ENTITY_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign modal */}
      <Modal title={assignCategory ? `Assign — ${assignCategory.name}` : ""} open={!!assignCategory} onCancel={() => setAssignCategory(null)} onOk={() => assignForm.submit()} okText="Assign">
        <Form form={assignForm} layout="vertical" onFinish={handleAssign} requiredMark={false}>
          <Form.Item label="Cycle" rules={[{ required: true }]}>
            <Select value={assignCycle} onChange={setAssignCycle} options={cycles.map((c) => ({ value: c.id, label: c.title }))} />
          </Form.Item>
          <Form.Item label="Sector" rules={[{ required: true }]}>
            <Select value={assignSector} onChange={setAssignSector} options={sectors.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item
            label="National result"
            name="sectorResultId"
            rules={[{ required: true, message: "Select the national result to map." }]}
          >
            <Select
              placeholder={nationalResults.length ? "Select result" : "Select a cycle and sector first"}
              options={nationalResults.map((r) => ({
                value: r.id,
                label: `${r.zone?.name ?? "—"} (${Number(r.sectorTotal).toFixed(2)})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
