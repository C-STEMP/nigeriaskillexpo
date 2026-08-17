import { z } from "zod";

export const applicantCategoryEnum = z.enum([
  "Trainee",
  "TSP",
  "Technical_College",
  "Instructor",
  "Industry_Partner",
]);

export const createSectorSchema = z.object({
  name: z.string().min(2).max(150),
  // Empty/omitted = applies to all applicant categories by default.
  applicableCategories: z.array(applicantCategoryEnum).optional().default([]),
});

export const updateSectorSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  disabled: z.boolean().optional(),
  applicableCategories: z.array(applicantCategoryEnum).optional(),
});

export const createTradeSchema = z.object({
  sectorId: z.string().cuid(),
  name: z.string().min(2).max(150),
});

export const updateTradeSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  disabled: z.boolean().optional(),
});

export const criterionScopeEnum = z.enum([
  "Global_AllTrades",
  "Global_PerSector",
  "Sector_Wide",
  "Trade_Specific",
]);

export const criterionLevelEnum = z.enum(["Zonal_Only", "National_Only", "Nationwide"]);

export const evidenceTypeEnum = z.enum([
  "Certificates",
  "Portfolios",
  "Employment_Records",
  "Business_Registration_Documents",
  "Business_Performance_Records",
  "Project_Photographs",
  "Videos",
  "References",
  "Testimonials",
]);

export const createCriterionSchema = z
  .object({
    cycleId: z.string().cuid(),
    text: z.string().min(5, "Question/requirement text is required."),
    maxScore: z.number().positive().max(1000),
    scope: criterionScopeEnum,
    level: criterionLevelEnum.default("Nationwide"),
    sectorId: z.string().cuid().optional(),
    tradeId: z.string().cuid().optional(),
    allowedEvidenceTypes: z.array(evidenceTypeEnum).min(1, "Select at least one evidence type."),
  })
  .superRefine((data, ctx) => {
    if (data.scope === "Sector_Wide" && !data.sectorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sectorId"],
        message: "Sector-wide criteria must specify a sector.",
      });
    }
    if (data.scope === "Trade_Specific" && (!data.sectorId || !data.tradeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tradeId"],
        message: "Trade-specific criteria must specify both sector and trade.",
      });
    }
    if ((data.scope === "Global_AllTrades" || data.scope === "Global_PerSector") && (data.sectorId || data.tradeId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scope"],
        message: "Global criteria should not specify a sector or trade.",
      });
    }
  });

export const updateCriterionSchema = z.object({
  text: z.string().min(5).optional(),
  maxScore: z.number().positive().max(1000).optional(),
  status: z.enum(["Draft", "Active", "Retired"]).optional(),
  allowedEvidenceTypes: z.array(evidenceTypeEnum).min(1).optional(),
});

export const createRegistrationCodeSchema = z.object({
  code: z.string().min(4).max(50),
});

export const createCycleSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  title: z.string().min(3).max(255),
  sectorIds: z.array(z.string().cuid()).optional().default([]),
});

export const updateCycleSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  status: z
    .enum([
      "Draft",
      "Open",
      "Registration_Closed",
      "Zonal_Locked",
      "National_Locked",
      "Archived",
    ])
    .optional(),
  registrationOpensAt: z.coerce.date().optional(),
  registrationClosesAt: z.coerce.date().optional(),
  sectorIds: z.array(z.string().cuid()).optional(),
});
