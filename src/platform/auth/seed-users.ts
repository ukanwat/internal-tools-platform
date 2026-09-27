import type { Role } from "@/generated/prisma/enums";

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** Fake users for the "sign in as" picker. Replaced by the SSO directory later. */
export const SEED_USERS: readonly SeedUser[] = [
  {
    id: "user_support",
    email: "sam.support@example.com",
    name: "Sam Support",
    role: "SUPPORT",
  },
  {
    id: "user_finance_approver",
    email: "fiona.finance@example.com",
    name: "Fiona Finance",
    role: "FINANCE_APPROVER",
  },
  {
    id: "user_compliance_reviewer",
    email: "riley.reviewer@example.com",
    name: "Riley Reviewer",
    role: "COMPLIANCE_REVIEWER",
  },
  {
    id: "user_compliance_lead",
    email: "lee.lead@example.com",
    name: "Lee Lead",
    role: "COMPLIANCE_LEAD",
  },
  {
    id: "user_admin",
    email: "ada.admin@example.com",
    name: "Ada Admin",
    role: "ADMIN",
  },
];
