import { z } from "zod";

export const submitScoreSchema = z.object({
  stateTradeEntryId: z.string().cuid(),
  criterionId: z.string().cuid(),
  value: z.number().min(0),
  comment: z.string().max(2000).optional(),
  evidenceTypeObserved: z
    .enum([
      "Certificates",
      "Portfolios",
      "Employment_Records",
      "Business_Registration_Documents",
      "Business_Performance_Records",
      "Project_Photographs",
      "Videos",
      "References",
      "Testimonials",
    ])
    .optional(),
  evidenceNote: z.string().max(2000).optional(),
  evidenceUrl: z.string().url().optional(),
});

export const submitScoreBatchSchema = z.object({
  stateTradeEntryId: z.string().cuid(),
  scores: z
    .array(
      z.object({
        criterionId: z.string().cuid(),
        value: z.number().min(0),
        comment: z.string().max(2000).optional(),
        evidenceTypeObserved: z
          .enum([
            "Certificates",
            "Portfolios",
            "Employment_Records",
            "Business_Registration_Documents",
            "Business_Performance_Records",
            "Project_Photographs",
            "Videos",
            "References",
            "Testimonials",
          ])
          .optional(),
        evidenceNote: z.string().max(2000).optional(),
        evidenceUrl: z.string().url().optional(),
      })
    )
    .min(1, "At least one score must be submitted."),
});
