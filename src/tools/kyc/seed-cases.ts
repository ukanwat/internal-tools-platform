import type { KycRiskLevel } from "@/generated/prisma/enums";

export type SeedKycCase = {
  id: string;
  customerName: string;
  customerEmail: string;
  country: string;
  riskLevel: KycRiskLevel;
  vendorCheckId: string;
};

/** Made-up customers for local development. Each points at a mock vendor check. */
export const SEED_KYC_CASES: readonly SeedKycCase[] = [
  {
    id: "kyc_case_1001",
    customerName: "Maya Okafor",
    customerEmail: "maya.okafor@example.com",
    country: "GB",
    riskLevel: "LOW",
    vendorCheckId: "chk_mock_1001",
  },
  {
    id: "kyc_case_1002",
    customerName: "Tomasz Nowicki",
    customerEmail: "tomasz.nowicki@example.com",
    country: "PL",
    riskLevel: "MEDIUM",
    vendorCheckId: "chk_mock_1002",
  },
  {
    id: "kyc_case_1003",
    customerName: "Priya Raman",
    customerEmail: "priya.raman@example.com",
    country: "IN",
    riskLevel: "HIGH",
    vendorCheckId: "chk_mock_1003",
  },
  {
    id: "kyc_case_1004",
    customerName: "Diego Alvarado",
    customerEmail: "diego.alvarado@example.com",
    country: "MX",
    riskLevel: "HIGH",
    vendorCheckId: "chk_mock_1004",
  },
  {
    id: "kyc_case_1005",
    customerName: "Lena Hoffmann",
    customerEmail: "lena.hoffmann@example.com",
    country: "DE",
    riskLevel: "LOW",
    vendorCheckId: "chk_mock_1005",
  },
  {
    id: "kyc_case_1006",
    customerName: "Noah Brennan",
    customerEmail: "noah.brennan@example.com",
    country: "IE",
    riskLevel: "MEDIUM",
    vendorCheckId: "chk_mock_unavailable",
  },
];
