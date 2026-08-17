import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveRoles, isOverallAdmin } from "@/lib/permissions";
import { UserType } from "@prisma/client";
import { getExecutiveOverviewData } from "@/server/services/dashboard-data";
import { StatCard } from "@/components/ui/stat-card";
import { CompletionGauge } from "@/components/ui/completion-gauge";
import { RegistrationTrendChart } from "@/components/charts/registration-trend-chart";
import { SectorBreakdownChart } from "@/components/charts/sector-breakdown-chart";
import { Icon } from "@/components/ui/icon";

export default async function ExecutiveOverviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const roles = await getActiveRoles(session.user.id);
  const isExecutive =
    isOverallAdmin(roles) || roles.some((r) => r.roleName === UserType.National_Admin);

  // This page is reserved for executive-level roles. Task-focused roles
  // (Zonal_Admin, assessors, moderators) and applicants get redirected to
  // their own simpler dashboard — they should never reach this dense view
  // even by direct URL.
  if (!isExecutive) {
    redirect("/dashboard/my-tasks");
  }

  const data = await getExecutiveOverviewData();

  if (!data) {
    return (
      <div className="rounded-xl border border-grey bg-white p-8 text-center">
        <p className="text-ink/60">
          No competition cycle has been configured yet. Create one under Cycle Settings to
          get started.
        </p>
      </div>
    );
  }

  const {
    cycle,
    totalApplicants,
    applicantsByCategory,
    sectorBreakdown,
    activeZonesCount,
    sectorsInCompetition,
    pendingModerationCases,
    overdueAssignments,
    completionPct,
    registrationTrend,
  } = data;

  const topSector = [...sectorBreakdown].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Executive Overview</h1>
          <p className="text-sm text-ink/60">
            {cycle.title} — live competition data
          </p>
        </div>
        <span className="text-xs text-ink/40">
          Data as of {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon="TeamOutlined"
          value={totalApplicants.toLocaleString()}
          label="Applicants"
          context="Across all categories"
        />
        <StatCard
          icon="GlobalOutlined"
          value={`${activeZonesCount}/6`}
          label="Active zones"
          context="Zones with registrations"
        />
        <StatCard
          icon="ApartmentOutlined"
          value={String(sectorsInCompetition)}
          label="Sectors in competition"
          context={`Cycle: ${cycle.year}`}
        />
        <StatCard
          icon="SafetyCertificateOutlined"
          value={String(pendingModerationCases)}
          label="Open moderation cases"
          context="Awaiting resolution"
        />
        <StatCard
          icon="ClockCircleOutlined"
          value={String(overdueAssignments)}
          label="Overdue assignments"
          context="Past their deadline"
        />
        <StatCard
          icon="TrophyOutlined"
          value={topSector ? topSector.sector : "—"}
          label="Leading sector"
          context={topSector ? `${topSector.count} applicants` : undefined}
          highlight
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-grey bg-white p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-ink">
            Registrations over time
          </h2>
          <RegistrationTrendChart data={registrationTrend} />
        </div>
        <div className="rounded-xl border border-grey bg-white p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-ink">
            Applicants by sector
          </h2>
          <SectorBreakdownChart data={sectorBreakdown} />
        </div>
      </div>

      {/* Gauge + category breakdown row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-grey bg-white p-5 flex items-center justify-center">
          <CompletionGauge value={completionPct} label="Panel assessments completed" />
        </div>
        <div className="rounded-xl border border-grey bg-white p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">
            Applicants by category
          </h2>
          <ul className="space-y-2">
            {applicantsByCategory.map((row) => (
              <li
                key={row.category}
                className="flex items-center justify-between border-b border-grey pb-2 text-sm last:border-0"
              >
                <span className="text-ink/70">{row.category?.replace(/_/g, " ")}</span>
                <span className="font-semibold text-ink">{row.count}</span>
              </li>
            ))}
            {applicantsByCategory.length === 0 && (
              <li className="text-sm text-ink/40">No applicants registered yet.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Insight banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary-accent bg-primary-accent/40 p-5">
        <span className="text-xl text-primary"><Icon name="BulbOutlined" /></span>
        <p className="text-sm text-ink/80">
          {topSector
            ? `${topSector.sector} currently leads with ${topSector.count} registered applicants. ${overdueAssignments > 0 ? `${overdueAssignments} panel assignment(s) are overdue and may need follow-up.` : "All panel assignments are currently on track."}`
            : "Registration data will populate this summary once applicants begin signing up."}
        </p>
      </div>
    </div>
  );
}
