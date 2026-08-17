import { z } from "zod";

export const createStateTradeEntrySchema = z.object({
  cycleId: z.string().cuid(),
  sectorId: z.string().cuid(),
  stateId: z.string().cuid(),
  tradeId: z.string().cuid(),
  applicantId: z.string().cuid(),
});

export const assignPanelSchema = z.object({
  assessorIds: z
    .array(z.string().cuid())
    .length(3, "Exactly 3 assessors must be assigned to a panel — no more, no fewer."),
  dueAt: z.coerce.date(),
});
