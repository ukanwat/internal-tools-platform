export type KycRiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** `clear` passed, `consider` needs a human look, `fail` did not pass. */
export type KycResultOutcome = "clear" | "consider" | "fail";

export type KycCheckResult = {
  key: string;
  label: string;
  outcome: KycResultOutcome;
  detail: string;
};

/** A completed identity check as the vendor reports it. */
export type KycCheck = {
  checkId: string;
  riskLevel: KycRiskLevel;
  completedAt: Date;
  document: {
    type: string;
    issuingCountry: string;
    /** Raw ID number. Never send it to the browser; use the sensitive module. */
    idNumber: string;
    expiresOn: string;
  };
  results: KycCheckResult[];
  /** The vendor's page for the check's ID documents. Documents are never stored here. */
  documentsUrl: string;
};

export type KycClient = {
  /** Returns null if the vendor has no check with this id. */
  getCheck(checkId: string): Promise<KycCheck | null>;
};

export class KycVendorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KycVendorError";
  }
}
