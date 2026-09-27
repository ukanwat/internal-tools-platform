export type RefundInput = {
  /** Same key, same result: retries never pay twice. */
  idempotencyKey: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
};

export type RefundResult = {
  refundId: string;
  /** True when this key was already processed and the original result is returned. */
  replayed: boolean;
};

export type RefundStatus = "pending" | "succeeded" | "failed";

export interface PaymentsClient {
  refund(input: RefundInput): Promise<RefundResult>;
  /**
   * The refund attempted with this idempotency key, or null if the provider
   * never received one. `pending` means it may still go through.
   */
  findRefund(
    idempotencyKey: string,
  ): Promise<{ refundId: string; status: RefundStatus } | null>;
}

export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentsError";
  }
}
