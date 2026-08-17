"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Alert,
  Upload,
  Collapse,
  Popconfirm,
} from "antd";
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { fetcher } from "@/lib/fetcher";
import { PageHeader } from "@/components/ui/page-header";
import { TableWrapper } from "@/components/ui/table-wrapper";

type Trade = { id: string; name: string; disabled: boolean };
type Sector = {
  id: string;
  name: string;
  disabled: boolean;
  applicableCategories: { category: string }[];
  _count: { trades: number; criteria: number };
};

const CATEGORY_OPTIONS = [
  { value: "Trainee", label: "Trainee" },
  { value: "TSP", label: "Training Service Provider" },
  { value: "Technical_College", label: "Technical College" },
  { value: "Instructor", label: "Instructor" },
  { value: "Industry_Partner", label: "Industry Partner" },
];

export default function SectorsPage() {
  const { data, isLoading } = useSWR<{ sectors: Sector[] }>("/api/admin/sectors", fetcher);
  const sectors = data?.sectors ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editSector, setEditSector] = useState<Sector | null>(null);
  const [tradeModalSector, setTradeModalSector] = useState<Sector | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [tradeForm] = Form.useForm();
  const [editTradeForm] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    sectorsCreated: number;
    tradesCreated: number;
    tradesSkipped: number;
    errors: string[];
  } | null>(null);

  // Trades are fetched per-sector on demand (Collapse panel open), keyed by SWR per sectorId
  const [openSectorIds, setOpenSectorIds] = useState<string[]>([]);

  function reloadSectors() {
    mutate("/api/admin/sectors");
  }

  async function handleCreateSector(values: { name: string; applicableCategories?: string[] }) {
    setError(null);
    const res = await fetch("/api/admin/sectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const resData = await res.json();
    if (!res.ok) { setError(resData.error ?? "Could not create sector."); return; }
    setCreateOpen(false);
    form.resetFields();
    reloadSectors();
  }

  function openEditSector(sector: Sector) {
    setEditSector(sector);
    editForm.setFieldsValue({
      name: sector.name,
      applicableCategories: sector.applicableCategories.map((c) => c.category),
    });
  }

  async function handleEditSector(values: { name: string; applicableCategories?: string[] }) {
    if (!editSector) return;
    setError(null);
    const res = await fetch(`/api/admin/sectors/${editSector.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const resData = await res.json();
    if (!res.ok) { setError(resData.error ?? "Could not update sector."); return; }
    setEditSector(null);
    reloadSectors();
  }

  async function handleDeleteSector(id: string) {
    const res = await fetch(`/api/admin/sectors/${id}`, { method: "DELETE" });
    const resData = await res.json();
    if (!res.ok) { setError(resData.error ?? "Could not delete sector."); return; }
    reloadSectors();
  }

  async function handleToggleDisabled(sector: Sector) {
    await fetch(`/api/admin/sectors/${sector.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !sector.disabled }),
    });
    reloadSectors();
  }

  async function handleAddTrade(values: { name: string }) {
    if (!tradeModalSector) return;
    setError(null);
    const res = await fetch("/api/admin/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectorId: tradeModalSector.id, name: values.name }),
    });
    const resData = await res.json();
    if (!res.ok) { setError(resData.error ?? "Could not add trade."); return; }
    tradeForm.resetFields();
    mutate(`/api/admin/trades?sectorId=${tradeModalSector.id}`);
    reloadSectors();
  }

  function openEditTrade(trade: Trade) {
    setEditTrade(trade);
    editTradeForm.setFieldsValue({ name: trade.name, disabled: trade.disabled });
  }

  async function handleEditTrade(values: { name: string; disabled: boolean }) {
    if (!editTrade || !tradeModalSector) return;
    setError(null);
    const res = await fetch(`/api/admin/trades/${editTrade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const resData = await res.json();
    if (!res.ok) { setError(resData.error ?? "Could not update trade."); return; }
    setEditTrade(null);
    mutate(`/api/admin/trades?sectorId=${tradeModalSector.id}`);
    reloadSectors();
  }

  async function handleDeleteTrade(tradeId: string, sectorId: string) {
    const res = await fetch(`/api/admin/trades/${tradeId}`, { method: "DELETE" });
    const resData = await res.json();
    if (!res.ok) { setError(resData.error ?? "Could not delete trade."); return; }
    mutate(`/api/admin/trades?sectorId=${sectorId}`);
    reloadSectors();
  }

  async function handleExcelUpload(file: File) {
    setImportResult(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/sectors/import", { method: "POST", body: formData });
    const resData = await res.json();
    if (res.ok) {
      setImportResult(resData.results);
      reloadSectors();
    } else {
      setError(resData.error ?? "Import failed.");
    }
    return false;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sectors & Trades"
        subtitle="Manage the skill sectors and the trades under each one."
        action={
          <>
            <Upload beforeUpload={handleExcelUpload} showUploadList={false} accept=".xlsx,.xls">
              <Button icon={<UploadOutlined />} className="cursor-pointer">Import trades (Excel)</Button>
            </Upload>
            <Button type="primary" icon={<PlusOutlined />} className="cursor-pointer" onClick={() => setCreateOpen(true)}>
              New sector
            </Button>
          </>
        }
      />

      {error && (
        <Alert type="error" showIcon title={error} closable={{ onClose: () => setError(null) }} className="rounded-lg" />
      )}

      {importResult && (
        <Alert
          type="success"
          showIcon
          closable={{ onClose: () => setImportResult(null) }}
          title={`Import complete: ${importResult.sectorsCreated} sectors created, ${importResult.tradesCreated} trades created, ${importResult.tradesSkipped} skipped (already existed).`}
          description={
            importResult.errors.length > 0 ? (
              <ul className="mt-2 list-disc pl-4 text-xs">
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            ) : undefined
          }
          className="rounded-lg"
        />
      )}

      <Collapse
        onChange={(keys) => {
          const opened = Array.isArray(keys) ? keys : [keys];
          setOpenSectorIds(opened.filter((k): k is string => typeof k === "string"));
        }}
        items={sectors.map((sector) => ({
          key: sector.id,
          label: (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-ink">{sector.name}</span>
              <div className="flex flex-wrap items-center gap-2">
                {sector.applicableCategories.length === 0 ? (
                  <Tag>All categories</Tag>
                ) : (
                  sector.applicableCategories.map((c) => <Tag key={c.category}>{c.category.replace(/_/g, " ")}</Tag>)
                )}
                <Tag color="default">{sector._count.trades} trades</Tag>
                {sector.disabled && <Tag color="red">Disabled</Tag>}
              </div>
            </div>
          ),
          children: (
            <SectorTradesPanel
              sector={sector}
              isOpen={openSectorIds.includes(sector.id)}
              onAddTrade={() => setTradeModalSector(sector)}
              onEditTrade={(t) => { setTradeModalSector(sector); openEditTrade(t); }}
              onDeleteTrade={(tradeId) => handleDeleteTrade(tradeId, sector.id)}
              onEditSector={() => openEditSector(sector)}
              onDeleteSector={() => handleDeleteSector(sector.id)}
              onToggleDisabled={() => handleToggleDisabled(sector)}
            />
          ),
        }))}
      />

      {/* Create sector modal */}
      <Modal title="New sector" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText="Create sector">
        <Form form={form} layout="vertical" onFinish={handleCreateSector} requiredMark={false}>
          <Form.Item label="Sector name" name="name" rules={[{ required: true, message: "Sector name is required." }]}>
            <Input placeholder="e.g. Building Construction" />
          </Form.Item>
          <Form.Item label="Applicable categories" name="applicableCategories" extra="Leave empty to apply to all applicant categories.">
            <Select mode="multiple" options={CATEGORY_OPTIONS} placeholder="All categories (default)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit sector modal */}
      <Modal title={editSector ? `Edit — ${editSector.name}` : ""} open={!!editSector} onCancel={() => setEditSector(null)} onOk={() => editForm.submit()} okText="Save changes">
        <Form form={editForm} layout="vertical" onFinish={handleEditSector} requiredMark={false}>
          <Form.Item label="Sector name" name="name" rules={[{ required: true, message: "Sector name is required." }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Applicable categories" name="applicableCategories" extra="Leave empty to apply to all applicant categories.">
            <Select mode="multiple" options={CATEGORY_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add trade modal */}
      <Modal
        title={tradeModalSector && !editTrade ? `Add trade — ${tradeModalSector.name}` : ""}
        open={!!tradeModalSector && !editTrade}
        onCancel={() => setTradeModalSector(null)}
        onOk={() => tradeForm.submit()}
        okText="Add trade"
      >
        <Form form={tradeForm} layout="vertical" onFinish={handleAddTrade} requiredMark={false}>
          <Form.Item label="Trade name" name="name" rules={[{ required: true, message: "Trade name is required." }]}>
            <Input placeholder="e.g. Bricklaying" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit trade modal */}
      <Modal
        title={editTrade ? `Edit trade — ${editTrade.name}` : ""}
        open={!!editTrade}
        onCancel={() => setEditTrade(null)}
        onOk={() => editTradeForm.submit()}
        okText="Save changes"
      >
        <Form form={editTradeForm} layout="vertical" onFinish={handleEditTrade} requiredMark={false}>
          <Form.Item label="Trade name" name="name" rules={[{ required: true, message: "Trade name is required." }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Disabled" name="disabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function SectorTradesPanel({
  sector,
  isOpen,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onEditSector,
  onDeleteSector,
  onToggleDisabled,
}: {
  sector: Sector;
  isOpen: boolean;
  onAddTrade: () => void;
  onEditTrade: (t: Trade) => void;
  onDeleteTrade: (tradeId: string) => void;
  onEditSector: () => void;
  onDeleteSector: () => void;
  onToggleDisabled: () => void;
}) {
  const { data, isLoading } = useSWR<{ trades: Trade[] }>(
    isOpen ? `/api/admin/trades?sectorId=${sector.id}` : null,
    fetcher
  );
  const trades = data?.trades ?? [];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button size="small" className="cursor-pointer" onClick={onAddTrade}>Add trade</Button>
          <Button size="small" icon={<EditOutlined />} className="cursor-pointer" onClick={onEditSector}>Edit sector</Button>
          <Popconfirm
            title="Delete this sector?"
            description="Only possible if it has no trades or criteria attached."
            onConfirm={onDeleteSector}
          >
            <Button size="small" danger icon={<DeleteOutlined />} className="cursor-pointer">Delete sector</Button>
          </Popconfirm>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink/50">Suspend from competition</span>
          <Switch checked={sector.disabled} onChange={onToggleDisabled} size="small" />
        </div>
      </div>
      {isLoading ? (
        <p className="text-sm text-ink/40">Loading trades...</p>
      ) : trades.length === 0 ? (
        <p className="text-sm text-ink/40">No trades yet under this sector.</p>
      ) : (
        <TableWrapper>
          <Table
            size="small"
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            dataSource={trades}
            rowKey="id"
            columns={[
              { title: "Trade", dataIndex: "name" },
              {
                title: "Status",
                render: (_: unknown, t: Trade) =>
                  t.disabled ? <Tag color="red">Disabled</Tag> : <Tag color="green">Active</Tag>,
              },
              {
                title: "",
                render: (_: unknown, t: Trade) => (
                  <div className="flex gap-2">
                    <Button size="small" icon={<EditOutlined />} className="cursor-pointer" onClick={() => onEditTrade(t)} />
                    <Popconfirm title="Delete this trade?" onConfirm={() => onDeleteTrade(t.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} className="cursor-pointer" />
                    </Popconfirm>
                  </div>
                ),
              },
            ]}
          />
        </TableWrapper>
      )}
    </div>
  );
}
