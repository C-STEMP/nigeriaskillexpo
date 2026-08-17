import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const zones = await prisma.zone.findMany({
    include: { states: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ zones });
}
