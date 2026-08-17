import { z } from "zod";

export const computeStateResultSchema = z.object({
  cycleId: z.string().cuid(),
  sectorId: z.string().cuid(),
  stateId: z.string().cuid(),
});

export const promoteZonalSchema = z.object({
  cycleId: z.string().cuid(),
  sectorId: z.string().cuid(),
  zoneId: z.string().cuid(),
});

export const promoteNationalSchema = z.object({
  cycleId: z.string().cuid(),
  sectorId: z.string().cuid(),
});
