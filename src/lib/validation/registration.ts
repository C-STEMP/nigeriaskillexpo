import { z } from "zod";

/**
 * Applicant categories where the registrant IS an individual (so gender is
 * required and name = first+last) vs an ORGANIZATION (name = organization
 * name, gender does not apply).
 */
export const INDIVIDUAL_CATEGORIES = ["Trainee", "Instructor"] as const;
export const ORGANIZATION_CATEGORIES = [
  "TSP",
  "Technical_College",
  "Industry_Partner",
] as const;

export const applicantCategoryEnum = z.enum([
  "Trainee",
  "TSP",
  "Technical_College",
  "Instructor",
  "Industry_Partner",
]);

const baseApplicantSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  applicantCategory: applicantCategoryEnum,
  phone: z.string().min(7).max(30).optional(),
  address: z.string().min(5, "Address is required.").max(500),
  stateId: z.string().cuid("Select a valid state."),
  country: z.literal("Nigeria").default("Nigeria"),

  // Individual-only fields — required conditionally, see superRefine below.
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  gender: z.enum(["Male", "Female"]).optional(),

  // Organization-only field.
  organizationName: z.string().min(2).max(255).optional(),

  // Trainees (and Instructors, per the trade/skill addition) register
  // under a trade. Optional at the base-schema level since not every
  // category needs it — enforced conditionally below.
  tradeId: z.string().cuid().optional(),

  cycleId: z.string().cuid("A competition cycle must be specified."),
});

export const applicantRegistrationSchema = baseApplicantSchema.superRefine(
  (data, ctx) => {
    const isIndividual = (
      INDIVIDUAL_CATEGORIES as readonly string[]
    ).includes(data.applicantCategory);

    if (isIndividual) {
      if (!data.firstName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["firstName"],
          message: "First name is required for this category.",
        });
      }
      if (!data.lastName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lastName"],
          message: "Last name is required for this category.",
        });
      }
      if (!data.gender) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gender"],
          message: "Gender is required for this category.",
        });
      }
      // Trade/skill is required for individual learner categories per the
      // post-meeting decision (Trainees, and Instructors share the same
      // sector/trade taxonomy).
      if (!data.tradeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tradeId"],
          message: "Select a trade/skill area.",
        });
      }
    } else {
      if (!data.organizationName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organizationName"],
          message: "Organization name is required for this category.",
        });
      }
    }
  }
);

export type ApplicantRegistrationInput = z.infer<
  typeof applicantRegistrationSchema
>;

/**
 * Staff registration (assessor/moderator/admin), gated behind the
 * super-admin-issued registration code. The role itself is NOT chosen by
 * the registrant — it's assigned afterward by whoever has authority — but
 * we still capture which zone they're registering in connection with,
 * since Zonal_Admin will need to know who to consider.
 */
export const staffRegistrationSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(30).optional(),
  zoneId: z.string().cuid("Select a zone."),
  registrationCode: z.string().min(4, "Enter the registration code."),
});

export type StaffRegistrationInput = z.infer<typeof staffRegistrationSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required."),
});
