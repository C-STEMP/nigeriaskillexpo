import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveRoles, isOverallAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import {
  EXECUTIVE_NAV,
  ZONAL_ADMIN_NAV,
  TASK_FOCUSED_NAV,
  APPLICANT_NAV,
} from "@/components/layout/nav-config";
import { UserType } from "@prisma/client";

function pickNavAndLabel(
  roles: Awaited<ReturnType<typeof getActiveRoles>>,
  isApplicant: boolean
) {
  if (isApplicant) return { nav: APPLICANT_NAV, scopeLabel: undefined };

  if (isOverallAdmin(roles) || roles.some((r) => r.roleName === UserType.National_Admin)) {
    return { nav: EXECUTIVE_NAV, scopeLabel: "National" };
  }
  if (roles.some((r) => r.roleName === UserType.Zonal_Admin)) {
    return { nav: ZONAL_ADMIN_NAV, scopeLabel: "Zonal" };
  }
  if (roles.some((r) => r.roleName === UserType.State_Assessor || r.roleName === UserType.State_Moderator)) {
    return { nav: TASK_FOCUSED_NAV, scopeLabel: "State" };
  }
  return { nav: TASK_FOCUSED_NAV, scopeLabel: undefined };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [roles, user] = await Promise.all([
    getActiveRoles(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  if (!user) redirect("/login");

  const isApplicant = Boolean(user.applicantCategory);
  const { nav, scopeLabel } = pickNavAndLabel(roles, isApplicant);

  const displayName =
    user.organizationName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const roleLabel = isApplicant
    ? user.applicantCategory?.replace(/_/g, " ")
    : roles[0]?.roleName.replace(/_/g, " ") ?? "Pending appointment";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={nav} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader
          userName={displayName || user.email}
          roleLabel={roleLabel ?? ""}
          scopeLabel={scopeLabel}
        />
        <main className="flex-1 overflow-y-auto bg-grey/30 p-6">{children}</main>
      </div>
    </div>
  );
}
