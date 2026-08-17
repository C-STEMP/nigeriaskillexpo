import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyPanelOverdue } from "@/server/services/notifications";

/**
 * Sweeps for TradeEntryPanel assignments past their dueAt with no
 * completedAt, and fires an overdue notification for each.
 *
 * THIS ROUTE NEEDS A SCHEDULER TO ACTUALLY RUN — Next.js API routes don't
 * execute on their own. Wire this up to one of:
 *   - Vercel Cron (vercel.json "crons" entry hitting this route daily), or
 *   - An external scheduler (cron job, GitHub Action) hitting this URL, or
 *   - A manual "check now" button in the Super_Admin dashboard
 * Protect it with a shared secret header in production so it can't be
 * triggered by anyone who finds the URL.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overdue = await prisma.tradeEntryPanel.findMany({
    where: {
      completedAt: null,
      dueAt: { lt: new Date() },
    },
    select: { id: true },
  });

  for (const panel of overdue) {
    await notifyPanelOverdue(panel.id);
  }

  return NextResponse.json({ checked: overdue.length });
}
