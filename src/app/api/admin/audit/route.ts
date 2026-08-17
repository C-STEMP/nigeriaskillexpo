import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-guard";

/**
 * Audit log is visible to Super_Admin, National_Admin, and Observer_Admin
 * — exactly the oversight roles per the workflow ("the final actions of
 * the assessor, moderator at all levels are recorded" so they "can be
 * traced and shown"). Zonal_Admin does NOT get blanket access here;
 * their oversight is scoped to their own zone's activity feed elsewhere,
 * not the raw global audit trail.
 */
export async function GET(req: NextRequest) {
  const guard = await requireRole("Super_Admin", "National_Admin", "Observer_Admin");
  if (!guard.ok) return guard.response;

  const action = req.nextUrl.searchParams.get("action");
  const logs = await prisma.auditLog.findMany({
    where: { action: (action as never) ?? undefined },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ logs });
}
