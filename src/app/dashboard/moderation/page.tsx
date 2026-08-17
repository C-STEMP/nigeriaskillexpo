"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Radio, Alert } from "antd";

type ModerationCase = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  resolution: string | null;
  score: {
    value: string;
    comment: string | null;
    criterion: { text: string; maxScore: string };
    assessor: { firstName: string | null; lastName: string | null };
    stateTradeEntry: {
      trade: { name: string };
      sector: { name: string };
      state: { name: string };
      applicant: { firstName: string | null; lastName: string | null; organizationName: string | null };
    };
  } | null;
  raisedBy: { firstName: string | null; lastName: string | null; organizationName: string | null };
};

const STATUS_COLORS: Record<string, string> = {
  Open: "gold",
  Under_Review: "blue",
  Resolved_Upheld: "green",
  Resolved_Overturned: "orange",
  Dismissed: "default",
};

export default function ModerationPage() {
  const { data, isLoading, mutate } = useSWR<{ cases: ModerationCase[] }>("/api/moderation", fetcher);
  const cases = data?.cases ?? [];

  const [activeCase, setActiveCase] = useState<ModerationCase | null>(null);
  const [resolution, setResolution] = useState<string>("Resolved_Upheld");
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleResolve(values: { resolutionText: string; overriddenValue?: number }) {
    if (!activeCase) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/moderation/${activeCase.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: resolution,
          resolution: values.resolutionText,
          overriddenValue: resolution === "Resolved_Overturned" ? values.overriddenValue : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not resolve case.");
        return;
      }
      setActiveCase(null);
      form.resetFields();
      mutate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation"
        subtitle="Cases raised against a score — review the full context before resolving."
      />

      <TableWrapper>
        <Table
          dataSource={cases}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            {
              title: "Entry",
              render: (_: unknown, c: ModerationCase) =>
                c.score ? (
                  <span className="text-sm">
                    {c.score.stateTradeEntry.applicant.organizationName ??
                      `${c.score.stateTradeEntry.applicant.firstName ?? ""} ${c.score.stateTradeEntry.applicant.lastName ?? ""}`.trim()}
                    {" — "}
                    {c.score.stateTradeEntry.trade.name} — {c.score.stateTradeEntry.sector.name}
                    <span className="text-ink/50"> ({c.score.stateTradeEntry.state.name})</span>
                  </span>
                ) : (
                  <span className="text-ink/40">No associated score</span>
                ),
            },
            { title: "Reason", dataIndex: "reason", width: 280 },
            {
              title: "Raised by",
              render: (_: unknown, c: ModerationCase) =>
                c.raisedBy.organizationName ?? `${c.raisedBy.firstName} ${c.raisedBy.lastName}`,
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (status: string) => (
                <Tag color={STATUS_COLORS[status]}>{status.replace(/_/g, " ")}</Tag>
              ),
            },
            {
              title: "",
              render: (_: unknown, c: ModerationCase) =>
                c.status === "Open" || c.status === "Under_Review" ? (
                  <Button size="small" type="primary" className="cursor-pointer" onClick={() => setActiveCase(c)}>
                    Review
                  </Button>
                ) : null,
            },
          ]}
        />
      </TableWrapper>

      <Modal
        title="Resolve moderation case"
        open={!!activeCase}
        onCancel={() => setActiveCase(null)}
        onOk={() => form.submit()}
        okText="Submit resolution"
        confirmLoading={submitting}
        width={560}
      >
        {error && <Alert type="error" showIcon title={error} className="mb-4 rounded-lg" closable={{ onClose: () => setError(null) }} />}

        {activeCase?.score && (
          <div className="mb-4 rounded-lg border border-grey bg-grey/20 p-4">
            <p className="text-sm font-medium text-ink">{activeCase.score.criterion.text}</p>
            <p className="mt-1 text-xs text-ink/60">
              Score given: <strong>{activeCase.score.value}</strong> / {activeCase.score.criterion.maxScore}
              {" by "}
              {activeCase.score.assessor.firstName} {activeCase.score.assessor.lastName}
            </p>
            {activeCase.score.comment && (
              <p className="mt-2 text-xs italic text-ink/70">
                Assessor's comment: "{activeCase.score.comment}"
              </p>
            )}
            <p className="mt-2 text-xs text-ink/60">
              <strong>Reason for dispute:</strong> {activeCase.reason}
            </p>
          </div>
        )}

        <Form form={form} layout="vertical" onFinish={handleResolve} requiredMark={false}>
          <Form.Item label="Decision">
            <Radio.Group value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <Radio.Button value="Resolved_Upheld">Uphold original score</Radio.Button>
              <Radio.Button value="Resolved_Overturned">Overturn score</Radio.Button>
              <Radio.Button value="Dismissed">Dismiss case</Radio.Button>
            </Radio.Group>
          </Form.Item>

          {resolution === "Resolved_Overturned" && (
            <Form.Item
              label="Corrected score"
              name="overriddenValue"
              rules={[{ required: true, message: "Enter the corrected score." }]}
            >
              <InputNumber
                min={0}
                max={activeCase?.score ? Number(activeCase.score.criterion.maxScore) : undefined}
                className="w-full"
              />
            </Form.Item>
          )}

          <Form.Item
            label="Explanation"
            name="resolutionText"
            rules={[{ required: true, message: "Please explain your resolution." }]}
          >
            <Input.TextArea rows={3} placeholder="Explain the reasoning behind this decision..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
