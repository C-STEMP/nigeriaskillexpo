import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveRoles, isOverallAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { UserType } from "@prisma/client";

/**
 * /dashboard itself is just a router. Executive roles land on the dense
 * overview; everyone else (Zonal_Admin, assessors, moderators, and
 * applicants) lands on the task-focused view. This keeps each dashboard
 * variant as its own real route (so sidebar links, redirects, and
 * "active" nav highlighting all point at something concrete) instead of
 * branching inside a single shared page component.
 */
export default async function DashboardRootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [roles, user] = await Promise.all([
    getActiveRoles(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  const isApplicant = Boolean(user?.applicantCategory);
  const isExecutive =
    isOverallAdmin(roles) || roles.some((r) => r.roleName === UserType.National_Admin);

  if (!isApplicant && isExecutive) {
    redirect("/dashboard/overview");
  }
  redirect("/dashboard/my-tasks");
}
