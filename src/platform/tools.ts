import type { Permission } from "@/platform/permissions/policy";

export type ToolIcon = "approvals" | "audit" | "refunds" | "kyc" | "flags";

export type ToolDefinition = {
  key: string;
  /** Tools are the ops workflows; platform pages (approvals, audit) serve every tool. */
  kind: "tool" | "platform";
  name: string;
  description: string;
  icon: ToolIcon;
  /** Where the tool lives; tools without one are shown as coming soon. */
  href?: string;
  /** Hides the tool from roles without this permission. Pages still enforce their own access. */
  permission?: Permission;
};

/** Every tool shown on the home page and in the sidebar. */
export const TOOLS: ToolDefinition[] = [
  {
    key: "approvals",
    kind: "platform",
    name: "Approvals",
    description: "Review requests that need a second person to sign off.",
    icon: "approvals",
    href: "/approvals",
  },
  {
    key: "refunds",
    kind: "tool",
    name: "Refunds",
    description: "Look up payments and request refunds for customers.",
    icon: "refunds",
    permission: "refunds.view",
  },
  {
    key: "kyc",
    kind: "tool",
    name: "KYC review",
    description: "Review identity checks and record compliance decisions.",
    icon: "kyc",
    permission: "kyc.view",
  },
  {
    key: "flags",
    kind: "tool",
    name: "Feature flags",
    description:
      "Change flags in staging, request production rollouts, and turn flags off.",
    icon: "flags",
    href: "/flags",
    permission: "flags.view",
  },
  {
    key: "audit",
    kind: "platform",
    name: "Audit log",
    description: "See who did what, when and why across every tool.",
    icon: "audit",
    href: "/admin/audit",
    permission: "audit.view",
  },
];
