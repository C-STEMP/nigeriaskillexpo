"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Button, Modal, Form, Input, Tag, Alert, Typography } from "antd";
import { PlusOutlined, CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Code = {
  id: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  retiredAt: string | null;
  _count: { registrants: number };
};

export default function RegistrationCodesPage() {
  const { data, isLoading, mutate } = useSWR<{ codes: Code[] }>("/api/admin/registration-codes", fetcher);
  const codes = data?.codes ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Code | null>(null);
  const [form] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function handleCreate(values: { code: string }) {
    setError(null);
    const res = await fetch("/api/admin/registration-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create code.");
      return;
    }
    setCreateOpen(false);
    form.resetFields();
    mutate();
  }

  async function handleReset(values: { newCode: string }) {
    if (!resetTarget) return;
    setError(null);
    const res = await fetch(`/api/admin/registration-codes/${resetTarget.id}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not reset code.");
      return;
    }
    setResetTarget(null);
    resetForm.resetFields();
    mutate();
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${origin}/register/staff/${code}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registration Codes"
        subtitle="Gate the staff registration page. Share the link below with intended assessors/moderators/admins — only those with the active code can complete registration."
        action={
          <Button type="primary" icon={<PlusOutlined />} className="cursor-pointer" onClick={() => setCreateOpen(true)}>
            New code
          </Button>
        }
      />

      {error && (
        <Alert type="error" showIcon title={error} closable={{ onClose: () => setError(null) }} className="rounded-lg" />
      )}

      <TableWrapper>
        <Table
          dataSource={codes}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            {
              title: "Code",
              dataIndex: "code",
              render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
            },
            {
              title: "Status",
              render: (_: unknown, c: Code) =>
                c.isActive ? <Tag color="green">Active</Tag> : <Tag>Retired</Tag>,
            },
            { title: "Registrants", render: (_: unknown, c: Code) => c._count.registrants },
            {
              title: "Created",
              dataIndex: "createdAt",
              render: (v: string) => new Date(v).toLocaleDateString("en-GB"),
            },
            {
              title: "",
              render: (_: unknown, c: Code) =>
                c.isActive ? (
                  <div className="flex gap-2">
                    <Button size="small" icon={<CopyOutlined />} className="cursor-pointer" onClick={() => copyLink(c.code)}>
                      Copy link
                    </Button>
                    <Button size="small" icon={<ReloadOutlined />} className="cursor-pointer" onClick={() => setResetTarget(c)}>
                      Reset
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </TableWrapper>

      <Modal
        title="New registration code"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="Create"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item label="Code" name="code" rules={[{ required: true, message: "Required.", min: 4 }]}>
            <Input placeholder="e.g. ELIMI-2027-STAFF" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resetTarget ? `Reset code — ${resetTarget.code}` : ""}
        open={!!resetTarget}
        onCancel={() => setResetTarget(null)}
        onOk={() => resetForm.submit()}
        okText="Reset"
      >
        <Alert type="warning" showIcon title="The old code will stop working immediately once reset." className="mb-4 rounded-lg" />
        <Form form={resetForm} layout="vertical" onFinish={handleReset} requiredMark={false}>
          <Form.Item label="New code" name="newCode" rules={[{ required: true, message: "Required.", min: 4 }]}>
            <Input placeholder="e.g. ELIMI-2027-STAFF-V2" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
