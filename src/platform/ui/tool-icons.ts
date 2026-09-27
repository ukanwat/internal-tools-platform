import {
  BadgeCheckIcon,
  HomeIcon,
  ReceiptTextIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";

import type { ToolIcon } from "@/platform/tools";

export const TOOL_ICONS: Record<ToolIcon | "home", LucideIcon> = {
  home: HomeIcon,
  approvals: BadgeCheckIcon,
  audit: ScrollTextIcon,
  refunds: ReceiptTextIcon,
  kyc: ShieldCheckIcon,
};
