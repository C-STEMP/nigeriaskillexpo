import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const zoneId = req.nextUrl.searchParams.get("zoneId");
  const states = await prisma.state.findMany({
    where: zoneId ? { zoneId } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ states });
}
