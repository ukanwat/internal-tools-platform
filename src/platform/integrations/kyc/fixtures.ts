import type { KycCheck } from "./types";

type Fixture = Omit<KycCheck, "checkId" | "documentsUrl" | "completedAt"> & {
  completedAt: string;
};

const clear = (key: string, label: string, detail: string) =>
  ({ key, label, outcome: "clear", detail }) as const;

/** Check ids that make the mock vendor misbehave, for exercising failure paths. */
export const MOCK_KYC_CHECK_IDS = {
  unavailable: "chk_mock_unavailable",
} as const;

/** Made-up checks the mock vendor returns. Seeded KYC cases point at these ids. */
export const MOCK_KYC_CHECKS: Record<string, Fixture> = {
  chk_mock_1001: {
    riskLevel: "LOW",
    completedAt: "2026-09-20T09:14:00Z",
    document: {
      type: "Passport",
      issuingCountry: "GB",
      idNumber: "533401872",
      expiresOn: "2031-04-11",
    },
    results: [
      clear("document", "Document authenticity", "No signs of tampering."),
      clear("face", "Face match", "Selfie matches the document photo (98%)."),
      clear("sanctions", "Sanctions screening", "No matches."),
      clear("pep", "Politically exposed person", "No matches."),
      clear("address", "Address verification", "Matched to a utility bill."),
    ],
  },
  chk_mock_1002: {
    riskLevel: "MEDIUM",
    completedAt: "2026-09-21T13:02:00Z",
    document: {
      type: "National ID card",
      issuingCountry: "PL",
      idNumber: "ZX7730215",
      expiresOn: "2029-11-30",
    },
    results: [
      clear("document", "Document authenticity", "No signs of tampering."),
      clear("face", "Face match", "Selfie matches the document photo (91%)."),
      clear("sanctions", "Sanctions screening", "No matches."),
      clear("pep", "Politically exposed person", "No matches."),
      {
        key: "address",
        label: "Address verification",
        outcome: "consider",
        detail: "Address on file differs from the one on the bank statement.",
      },
    ],
  },
  chk_mock_1003: {
    riskLevel: "HIGH",
    completedAt: "2026-09-22T08:47:00Z",
    document: {
      type: "Passport",
      issuingCountry: "IN",
      idNumber: "T4418093Q",
      expiresOn: "2030-02-17",
    },
    results: [
      clear("document", "Document authenticity", "No signs of tampering."),
      clear("face", "Face match", "Selfie matches the document photo (95%)."),
      clear("sanctions", "Sanctions screening", "No matches."),
      {
        key: "pep",
        label: "Politically exposed person",
        outcome: "consider",
        detail: "Possible match: close relative of a regional official.",
      },
      clear("address", "Address verification", "Matched to a tax document."),
    ],
  },
  chk_mock_1004: {
    riskLevel: "HIGH",
    completedAt: "2026-09-23T17:30:00Z",
    document: {
      type: "Driving licence",
      issuingCountry: "MX",
      idNumber: "ALVD880512HX",
      expiresOn: "2026-10-05",
    },
    results: [
      {
        key: "document",
        label: "Document authenticity",
        outcome: "consider",
        detail: "Document expires within 30 days.",
      },
      {
        key: "face",
        label: "Face match",
        outcome: "consider",
        detail: "Low-confidence match (72%).",
      },
      {
        key: "sanctions",
        label: "Sanctions screening",
        outcome: "fail",
        detail: "Name and birth year match a sanctions list entry.",
      },
      clear("pep", "Politically exposed person", "No matches."),
      clear("address", "Address verification", "Matched to a lease."),
    ],
  },
  chk_mock_1005: {
    riskLevel: "LOW",
    completedAt: "2026-09-24T11:05:00Z",
    document: {
      type: "National ID card",
      issuingCountry: "DE",
      idNumber: "L01X00T47",
      expiresOn: "2033-07-22",
    },
    results: [
      clear("document", "Document authenticity", "No signs of tampering."),
      clear("face", "Face match", "Selfie matches the document photo (97%)."),
      clear("sanctions", "Sanctions screening", "No matches."),
      clear("pep", "Politically exposed person", "No matches."),
      clear("address", "Address verification", "Matched to a registry record."),
    ],
  },
};
