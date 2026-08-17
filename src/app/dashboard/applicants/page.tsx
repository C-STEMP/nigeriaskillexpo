"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Table, Select, Input, Tag, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type Applicant = {
  id: string;
  email: string;
  applicantCategory: string;
  firstName: string | null;
  lastName: string | null;
  organizationName: string | null;
  gender: string | null;
  trade: { name: string; sector: { name: string } } | null;
  state: { name: string; zone: { name: string } } | null;
  createdAt: string;
};
type Sector = { id: string; name: string };

const CATEGORY_OPTIONS = [
  { value: "Trainee", label: "Trainee" },
  { value: "TSP", label: "Training Service Provider" },
  { value: "Technical_College", label: "Technical College" },
  { value: "Instructor", label: "Instructor" },
  { value: "Industry_Partner", label: "Industry Partner" },
];

function displayName(a: Applicant) {
  return a.organizationName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
}

export default function ApplicantsPage() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [sectorId, setSectorId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce the search term itself so the SWR key only changes (and
  // therefore only re-fetches) after the user stops typing for 300ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: sectorsData } = useSWR<{ sectors: Sector[] }>("/api/public/sectors", fetcher);
  const sectors = sectorsData?.sectors ?? [];

  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (sectorId) params.set("sectorId", sectorId);
  if (debouncedSearch) params.set("search", debouncedSearch);
  const { data, isLoading } = useSWR<{ applicants: Applicant[] }>(
    `/api/admin/applicants?${params.toString()}`,
    fetcher
  );
  const applicants = data?.applicants ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applicants"
        subtitle="Everyone registered for the current competition cycle, across all categories."
      />

      <Space wrap>
        <Input
          placeholder="Search name, organization, or email"
          prefix={<SearchOutlined />}
          className="w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Select
          placeholder="Category"
          allowClear
          className="w-56"
          options={CATEGORY_OPTIONS}
          onChange={setCategory}
        />
        <Select
          placeholder="Sector"
          allowClear
          className="w-56"
          options={sectors.map((s) => ({ value: s.id, label: s.name }))}
          onChange={setSectorId}
        />
      </Space>

      <TableWrapper>
        <Table
          dataSource={applicants}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 40, hideOnSinglePage: true }}
          columns={[
            { title: "Name", render: (_: unknown, a: Applicant) => displayName(a) },
            { title: "Email", dataIndex: "email" },
            {
              title: "Category",
              dataIndex: "applicantCategory",
              render: (v: string) => <Tag>{v.replace(/_/g, " ")}</Tag>,
            },
            {
              title: "Trade / Sector",
              render: (_: unknown, a: Applicant) =>
                a.trade ? `${a.trade.name} — ${a.trade.sector.name}` : "—",
            },
            {
              title: "State / Zone",
              render: (_: unknown, a: Applicant) =>
                a.state ? `${a.state.name} (${a.state.zone.name})` : "—",
            },
            {
              title: "Registered",
              dataIndex: "createdAt",
              render: (v: string) => new Date(v).toLocaleDateString("en-GB"),
            },
          ]}
        />
      </TableWrapper>
    </div>
  );
}
