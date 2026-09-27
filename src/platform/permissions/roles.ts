import type { Role } from "@/generated/prisma/enums";

export type { Role };

export const ROLE_LABELS: Record<Role, string> = {
  SUPPORT: "Support",
  FINANCE_APPROVER: "Finance approver",
  COMPLIANCE_REVIEWER: "Compliance reviewer",
  COMPLIANCE_LEAD: "Compliance lead",
  ADMIN: "Admin",
};
