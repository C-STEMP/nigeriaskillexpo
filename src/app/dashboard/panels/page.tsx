"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Select, DatePicker, Button, Alert, Tag, Modal } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Entry = {
  id: string;
  trade: { name: string };
  sector: { name: string };
  state: { id: string; name: string; zone: { id: string; name: string } };
  applicant: { firstName: string | null; lastName: string | null; organizationName: string | null };
  panel: { assessor: { id: string; firstName: string | null; lastName: string | null } }[];
};
type Assessor = { id: string; name: string; email: string };

export default function PanelsPage() {
  const { data, isLoading, mutate } = useSWR<{ entries: Entry[] }>(
    "/api/zonal/state-trade-entries?needsPanel=true",
    fetcher
  );
  const entries = data?.entries ?? [];

  const [modalEntry, setModalEntry] = useState<Entry | null>(null);
  const [selectedAssessors, setSelectedAssessors] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState<Dayjs | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: assessorsData } = useSWR<{ assessors: Assessor[] }>(
    modalEntry
      ? `/api/zonal/assignable-assessors?entryId=${modalEntry.id}`
      : null,
    fetcher
  );
  const assessors = assessorsData?.assessors ?? [];

  function openModal(entry: Entry) {
    setModalEntry(entry);
    setSelectedAssessors([]);
    setDueAt(null);
    setError(null);
  }

  async function handleAssign() {
    if (!modalEntry || !dueAt) return;
    if (selectedAssessors.length !== 3) {
      setError("Select exactly 3 assessors.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/zonal/state-trade-entries/${modalEntry.id}/panel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessorIds: selectedAssessors, dueAt: dueAt.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not assign panel.");
        return;
      }
      setModalEntry(null);
      mutate();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panels & Assignments"
        subtitle="Assign exactly 3 assessors and a deadline to each trade entry awaiting a panel."
      />

      <TableWrapper>
        <Table
          dataSource={entries}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            {
              title: "Applicant",
              render: (_: unknown, row: Entry) =>
                row.applicant.organizationName ??
                `${row.applicant.firstName ?? ""} ${row.applicant.lastName ?? ""}`.trim(),
            },
            { title: "Trade", dataIndex: ["trade", "name"] },
            { title: "Sector", dataIndex: ["sector", "name"] },
            { title: "State", dataIndex: ["state", "name"] },
            {
              title: "Panel",
              render: (_: unknown, row: Entry) =>
                row.panel.length === 0 ? (
                  <Tag color="gold">Needs panel</Tag>
                ) : (
                  <Tag color="green">{row.panel.length}/3 assigned</Tag>
                ),
            },
            {
              title: "",
              render: (_: unknown, row: Entry) => (
                <Button size="small" type="primary" className="cursor-pointer" onClick={() => openModal(row)}>
                  Assign panel
                </Button>
              ),
            },
          ]}
        />
      </TableWrapper>

      <Modal
        title={
          modalEntry
            ? `Assign panel — ${modalEntry.applicant.organizationName ?? `${modalEntry.applicant.firstName ?? ""} ${modalEntry.applicant.lastName ?? ""}`.trim()} (${modalEntry.trade.name}, ${modalEntry.state.name})`
            : ""
        }
        open={!!modalEntry}
        onCancel={() => setModalEntry(null)}
        onOk={handleAssign}
        okText="Assign panel"
        confirmLoading={submitting}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" />}

        <p className="mb-2 text-sm font-medium text-ink">Assessors (select exactly 3)</p>
        <Select
          mode="multiple"
          className="mb-4 w-full"
          placeholder="Select 3 assessors"
          value={selectedAssessors}
          onChange={setSelectedAssessors}
          maxCount={3}
          options={assessors.map((a) => ({ value: a.id, label: `${a.name} (${a.email})` }))}
        />

        <p className="mb-2 text-sm font-medium text-ink">Deadline</p>
        <DatePicker
          className="w-full"
          value={dueAt}
          onChange={setDueAt}
          disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
        />
      </Modal>
    </div>
  );
}
