import { z } from "zod";

export const sendDirectMessageSchema = z.object({
  recipientId: z.string().cuid(),
  subject: z.string().max(255).optional(),
  body: z.string().min(1, "Message cannot be empty.").max(5000),
});

export const sendBroadcastMessageSchema = z.object({
  subject: z.string().max(255).optional(),
  body: z.string().min(1, "Message cannot be empty.").max(5000),
  target: z.object({
    type: z.enum(["Everyone", "Specific_Role", "Specific_Zone", "Specific_Role_In_Zone"]),
    role: z
      .enum([
        "Super_Admin",
        "Observer_Admin",
        "National_Admin",
        "National_Moderator",
        "National_Assessor",
        "Zonal_Admin",
        "Trainee",
        "TSP",
        "Technical_College",
        "Instructor",
        "Industry_Partner",
        "Zonal_Moderator",
        "Zonal_Assessor",
      ])
      .optional(),
    zoneId: z.string().cuid().optional(),
  }),
});

export const replyMessageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty.").max(5000),
});
