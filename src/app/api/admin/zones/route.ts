import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const zones = await prisma.zone.findMany({
    include: {
      states: {
        orderBy: { name: "asc" },
        include: { _count: { select: { applicants: true } } },
      },
      userRoles: { where: { revokedAt: null }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  const withCounts = zones.map((z) => ({
    ...z,
    activeStaffCount: z.userRoles.length,
  }));

  return NextResponse.json({ zones: withCounts });
}
