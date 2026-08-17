import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRoles } from "@/lib/permissions";
import { UserType } from "@prisma/client";
import { StatCard } from "@/components/ui/stat-card";

async function ApplicantStatusView({ userId }: { userId: string }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { trade: { include: { sector: true } }, state: { include: { zone: true } } },
  });
  if (!user) redirect("/login");

  const entries = await prisma.stateTradeEntry.findMany({
    where: { applicantId: user.id },
    include: { panel: { include: { assessor: true } }, sector: true },
  });

  const myEntry = entries[0]
    ? { ...entries[0], panel: entries[0].panel.filter((p) => p.level === entries[0].currentLevel) }
    : undefined;
  const panelComplete = myEntry?.panel.length === 3 && myEntry.panel.every((p) => p.completedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Welcome{user.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-sm text-ink/60">
          {user.trade ? `${user.trade.name} — ${user.trade.sector.name}` : "Your registration"}
          {user.state ? ` · ${user.state.name}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon="TeamOutlined"
          value={myEntry ? `${myEntry.panel.length}/3` : "0/3"}
          label="Panel assigned"
          context={myEntry?.panel.length ? "Assessors confirmed" : "Awaiting assignment"}
        />
        <StatCard
          icon="CheckSquareOutlined"
          value={panelComplete ? "Complete" : "In progress"}
          label="Assessment status"
          highlight={panelComplete}
        />
        <StatCard
          icon="SafetyCertificateOutlined"
          value={myEntry?.tradeTotal ? Number(myEntry.tradeTotal).toFixed(1) : "—"}
          label="Score"
          context={myEntry?.tradeTotal ? "Awaiting stage results" : "Not yet scored"}
        />
      </div>

      {myEntry && myEntry.panel.length > 0 && (
        <div className="rounded-xl border border-grey bg-white p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">
            Your assessment panel
          </h2>
          <ul className="divide-y divide-grey">
            {myEntry.panel.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink/80">
                  {p.assessor.organizationName ??
                    `${p.assessor.firstName} ${p.assessor.lastName}`}
                </span>
                <span className={p.completedAt ? "text-green-600" : "text-ink/40"}>
                  {p.completedAt ? "Completed" : `Due ${p.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-primary-accent bg-primary-accent/40 p-5">
        <p className="text-sm text-ink/80">
          Questions about your assessment? You can message your Zonal Admin directly.
        </p>
        <Link
          href="/dashboard/messages/compose"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Send a message →
        </Link>
      </div>
    </div>
  );
}

export default async function MyTasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [roles, user] = await Promise.all([
    getActiveRoles(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  if (!user) redirect("/login");

  if (user.applicantCategory) {
    return <ApplicantStatusView userId={session.user.id} />;
  }

  const isAssessor = roles.some(
    (r) => r.roleName === UserType.Zonal_Assessor || r.roleName === UserType.National_Assessor
  );

  // Pending assignments — only meaningful for assessors. Other roles
  // (Zonal_Admin, moderators) see zero here, which is correct, not a bug
  // — their "tasks" come from different sources (pending appointments,
  // moderation queue) surfaced on their own dashboard sections.
  const pendingAssignments = isAssessor
    ? await prisma.tradeEntryPanel.findMany({
        where: { assessorId: session.user.id, completedAt: null },
        include: {
          stateTradeEntry: { include: { trade: true, sector: true, state: true, applicant: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 10,
      })
    : [];

  const overdueCount = pendingAssignments.filter((a) => a.dueAt < new Date()).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">
          Welcome back{user.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-sm text-ink/60">Here's what needs your attention.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon="ClockCircleOutlined"
          value={String(pendingAssignments.length)}
          label="Pending assignments"
          highlight={pendingAssignments.length > 0}
        />
        <StatCard
          icon="CheckSquareOutlined"
          value={String(overdueCount)}
          label="Overdue"
          context={overdueCount > 0 ? "Needs immediate attention" : "All on track"}
        />
        <StatCard
          icon="SafetyCertificateOutlined"
          value="—"
          label="Moderation cases"
          context="Coming soon"
        />
      </div>

      {isAssessor && (
        <div className="rounded-xl border border-grey bg-white p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-ink">
            Your assignments
          </h2>
          {pendingAssignments.length === 0 ? (
            <p className="text-sm text-ink/40">
              You have no pending assignments right now.
            </p>
          ) : (
            <ul className="divide-y divide-grey">
              {pendingAssignments.map((a) => {
                const overdue = a.dueAt < new Date();
                return (
                  <li key={a.id} className="py-1">
                    <Link
                      href={`/dashboard/entries/${a.stateTradeEntryId}`}
                      className="flex items-center justify-between rounded-lg py-2 px-2 -mx-2 hover:bg-grey/40 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {a.stateTradeEntry.applicant.organizationName ??
                            `${a.stateTradeEntry.applicant.firstName ?? ""} ${a.stateTradeEntry.applicant.lastName ?? ""}`.trim()}
                        </p>
                        <p className="text-xs text-ink/50">
                          {a.stateTradeEntry.trade.name} — {a.stateTradeEntry.sector.name} · {a.stateTradeEntry.state.name}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium ${overdue ? "text-primary" : "text-ink/50"}`}
                      >
                        Due {a.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
