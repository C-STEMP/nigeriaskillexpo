import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Lightweight public sector list (id + name only) for the public results
 * page's sector picker. Deliberately separate from /api/admin/sectors —
 * that route happens to have no GET-side auth either, but living under
 * /admin/ is misleading for something a public, unauthenticated page
 * depends on, and risks someone adding auth there later and silently
 * breaking this page.
 */
export async function GET() {
  const sectors = await prisma.sector.findMany({
    where: { disabled: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ sectors });
}
