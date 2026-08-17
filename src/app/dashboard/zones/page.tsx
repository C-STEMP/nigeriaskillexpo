"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Collapse, Table, Tag } from "antd";
import { TableWrapper } from "@/components/ui/table-wrapper";
import { PageHeader } from "@/components/ui/page-header";

type StateRow = { id: string; name: string; _count: { applicants: number } };
type ZoneRow = { id: string; name: string; states: StateRow[]; activeStaffCount: number };

export default function ZonesPage() {
  const { data, isLoading } = useSWR<{ zones: ZoneRow[] }>("/api/admin/zones", fetcher);
  const zones = data?.zones ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zones & States"
        subtitle="Nigeria's 6 geopolitical zones and their states — applicant counts and active staff per zone."
      />

      {isLoading ? (
        <p className="text-sm text-ink/40">Loading...</p>
      ) : (
        <Collapse
          items={zones.map((zone) => {
            const totalApplicants = zone.states.reduce((sum, s) => sum + s._count.applicants, 0);
            return {
              key: zone.id,
              label: (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{zone.name}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag color="default">{zone.states.length} states</Tag>
                    <Tag color="default">{totalApplicants} applicants</Tag>
                    <Tag color="green">{zone.activeStaffCount} active staff</Tag>
                  </div>
                </div>
              ),
              children: (
                <TableWrapper>
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={zone.states}
                    rowKey="id"
                    columns={[
                      { title: "State", dataIndex: "name" },
                      {
                        title: "Applicants",
                        render: (_: unknown, s: StateRow) => s._count.applicants,
                      },
                    ]}
                  />
                </TableWrapper>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
