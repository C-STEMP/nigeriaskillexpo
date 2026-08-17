import { z } from "zod";

export const openModerationCaseSchema = z.object({
  scoreId: z.string().cuid().optional(),
  reason: z.string().min(10, "Please describe the reason for this moderation case."),
});

export const resolveModerationCaseSchema = z.object({
  status: z.enum(["Resolved_Upheld", "Resolved_Overturned", "Dismissed"]),
  resolution: z.string().min(5, "Please explain the resolution."),
  // Only used when status = Resolved_Overturned — the corrected value.
  overriddenValue: z.number().min(0).optional(),
});
