"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { Table, Button, Modal, Form, Select, Tag, Alert, Tabs, Popconfirm } from "antd";
import { fetcher } from "@/lib/fetcher";
import { PageHeader } from "@/components/ui/page-header";
import { TableWrapper } from "@/components/ui/table-wrapper";

type Zone = { id: string; name: string };
type StateRow = { id: string; name: string; zoneId: string };
type PendingUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  intendedZone: Zone | null;
  createdAt: string;
};
type ActiveRoleRow = {
  id: string;
  role: { name: string };
  zone: Zone | null;
  state?: { name: string } | null;
  grantedAt: string;
  user: { firstName: string | null; lastName: string | null; email: string };
};

const ROLE_OPTIONS = [
  { value: "State_Assessor", label: "State Assessor" },
  { value: "State_Moderator", label: "State Moderator" },
  { value: "Zonal_Assessor", label: "Zonal Assessor" },
  { value: "Zonal_Moderator", label: "Zonal Moderator" },
];

const STATE_SCOPED_ROLES = new Set(["State_Assessor", "State_Moderator"]);

export default function StaffPage() {
  const { data: pendingData, isLoading: pendingLoading } = useSWR<{ pending: PendingUser[] }>(
    "/api/admin/staff/pending",
    fetcher
  );
  const { data: staffData, isLoading: staffLoading } = useSWR<{ roles: ActiveRoleRow[] }>(
    "/api/admin/staff",
    fetcher
  );
  const { data: zonesData } = useSWR<{ zones: Zone[] }>("/api/public/zones", fetcher);

  const pending = pendingData?.pending ?? [];
  const activeRoles = staffData?.roles ?? [];
  const zones = zonesData?.zones ?? [];

  const [appointUser, setAppointUser] = useState<PendingUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [selectedZoneId, setSelectedZoneId] = useState<string | undefined>(undefined);
  const [statesInZone, setStatesInZone] = useState<StateRow[]>([]);
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);

  function reload() {
    mutate("/api/admin/staff/pending");
    mutate("/api/admin/staff");
  }

  async function loadStatesForZone(zoneId: string) {
    const res = await fetch(`/api/public/states?zoneId=${zoneId}`);
    const data = await res.json();
    setStatesInZone(data.states ?? []);
  }

  function openAppointModal(user: PendingUser) {
    setAppointUser(user);
    setSelectedRole(undefined);
    setSelectedZoneId(user.intendedZone?.id);
    setStatesInZone([]);
    if (user.intendedZone?.id) loadStatesForZone(user.intendedZone.id);
    form.resetFields();
  }

  async function handleAppoint(values: { roleName: string; zoneId: string; stateId?: string }) {
    if (!appointUser) return;
    setError(null);
    const res = await fetch(`/api/admin/staff/${appointUser.id}/grant-role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        scope: STATE_SCOPED_ROLES.has(values.roleName) ? "State" : "Zonal",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not appoint role.");
      return;
    }
    setAppointUser(null);
    form.resetFields();
    reload();
  }

  async function handleRevoke(userRoleId: string) {
    await fetch(`/api/admin/roles/${userRoleId}/revoke`, { method: "POST" });
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Roles"
        subtitle="Appoint pending registrants and manage active State/Zonal assessor and moderator roles."
      />

      <Tabs
        items={[
          {
            key: "pending",
            label: `Pending appointment (${pending.length})`,
            children: (
              <TableWrapper>
                <Table
                  dataSource={pending}
                  rowKey="id"
                  loading={pendingLoading}
                  pagination={{ pageSize: 40, hideOnSinglePage: true }}
                  columns={[
                    { title: "Name", render: (_: unknown, u: PendingUser) => `${u.firstName} ${u.lastName}` },
                    { title: "Email", dataIndex: "email" },
                    { title: "Intended zone", render: (_: unknown, u: PendingUser) => u.intendedZone?.name ?? "—" },
                    {
                      title: "Registered",
                      dataIndex: "createdAt",
                      render: (v: string) => new Date(v).toLocaleDateString("en-GB"),
                    },
                    {
                      title: "",
                      render: (_: unknown, u: PendingUser) => (
                        <Button size="small" type="primary" className="cursor-pointer" onClick={() => openAppointModal(u)}>
                          Appoint
                        </Button>
                      ),
                    },
                  ]}
                />
              </TableWrapper>
            ),
          },
          {
            key: "active",
            label: "Active staff",
            children: (
              <TableWrapper>
                <Table
                  dataSource={activeRoles}
                  rowKey="id"
                  loading={staffLoading}
                  pagination={{ pageSize: 40, hideOnSinglePage: true }}
                  columns={[
                    { title: "Name", render: (_: unknown, r: ActiveRoleRow) => `${r.user.firstName} ${r.user.lastName}` },
                    { title: "Email", render: (_: unknown, r: ActiveRoleRow) => r.user.email },
                    { title: "Role", render: (_: unknown, r: ActiveRoleRow) => <Tag>{r.role.name.replace(/_/g, " ")}</Tag> },
                    {
                      title: "Scope",
                      render: (_: unknown, r: ActiveRoleRow) =>
                        r.state?.name ?? r.zone?.name ?? "National",
                    },
                    {
                      title: "Since",
                      dataIndex: "grantedAt",
                      render: (v: string) => new Date(v).toLocaleDateString("en-GB"),
                    },
                    {
                      title: "",
                      render: (_: unknown, r: ActiveRoleRow) => (
                        <Popconfirm
                          title="Revoke this role?"
                          description="This will be recorded in the audit log."
                          onConfirm={() => handleRevoke(r.id)}
                        >
                          <Button size="small" danger className="cursor-pointer">
                            Revoke
                          </Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </TableWrapper>
            ),
          },
        ]}
      />

      <Modal
        title={appointUser ? `Appoint — ${appointUser.firstName} ${appointUser.lastName}` : ""}
        open={!!appointUser}
        onCancel={() => setAppointUser(null)}
        onOk={() => form.submit()}
        okText="Appoint"
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}
        <Form form={form} layout="vertical" onFinish={handleAppoint} requiredMark={false}>
          <Form.Item label="Role" name="roleName" rules={[{ required: true, message: "Select a role." }]}>
            <Select options={ROLE_OPTIONS} onChange={setSelectedRole} />
          </Form.Item>
          <Form.Item
            label="Zone"
            name="zoneId"
            initialValue={appointUser?.intendedZone?.id}
            rules={[{ required: true, message: "Select a zone." }]}
          >
            <Select
              options={zones.map((z) => ({ value: z.id, label: z.name }))}
              onChange={(zoneId) => {
                setSelectedZoneId(zoneId);
                form.setFieldValue("stateId", undefined);
                loadStatesForZone(zoneId);
              }}
            />
          </Form.Item>
          {selectedRole && STATE_SCOPED_ROLES.has(selectedRole) && (
            <Form.Item
              label="State"
              name="stateId"
              rules={[{ required: true, message: "Select the specific state this assessor will serve." }]}
              extra="State Assessors are scoped to exactly one state — they will only see and score entries within it."
            >
              <Select
                placeholder={selectedZoneId ? "Select state" : "Select a zone first"}
                disabled={!selectedZoneId}
                options={statesInZone.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
