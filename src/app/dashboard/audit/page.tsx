"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Tag, Select } from "antd";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type AuditLog = {
  id: string;
  action: string;
  metadata: string;
  createdAt: string;
  actor: { firstName: string | null; lastName: string | null; organizationName: string | null; email: string };
};

const ACTION_OPTIONS = [
  "SCORE_SUBMITTED", "SCORE_EDITED", "MODERATION_OPENED", "MODERATION_RESOLVED",
  "CRITERION_LOCKED", "CRITERION_UNLOCKED", "PROMOTION_RUN", "CYCLE_STATUS_CHANGED",
  "ROLE_GRANTED", "ROLE_REVOKED", "REGISTRATION_CODE_RESET", "AWARD_RESULT_ASSIGNED",
  "SECTOR_DISABLED", "SECTOR_ENABLED",
];

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const url = actionFilter ? `/api/admin/audit?action=${actionFilter}` : "/api/admin/audit";
  const { data, isLoading } = useSWR<{ logs: AuditLog[] }>(url, fetcher);
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Every recorded action, for full accountability and traceability."
        action={
          <Select
            allowClear
            placeholder="Filter by action"
            className="w-64"
            options={ACTION_OPTIONS.map((a) => ({ value: a, label: a.replace(/_/g, " ") }))}
            onChange={setActionFilter}
          />
        }
      />

      <TableWrapper>
        <Table
          dataSource={logs}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            {
              title: "When",
              dataIndex: "createdAt",
              width: 160,
              render: (v: string) =>
                new Date(v).toLocaleString("en-GB", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                }),
            },
            {
              title: "Actor",
              render: (_: unknown, log: AuditLog) =>
                log.actor.organizationName ??
                (`${log.actor.firstName ?? ""} ${log.actor.lastName ?? ""}`.trim() || log.actor.email),
            },
            {
              title: "Action",
              dataIndex: "action",
              render: (action: string) => <Tag>{action.replace(/_/g, " ")}</Tag>,
            },
            {
              title: "Details",
              dataIndex: "metadata",
              render: (metadata: string) => <code className="text-xs text-ink/50">{metadata}</code>,
            },
          ]}
        />
      </TableWrapper>
    </div>
  );
}
