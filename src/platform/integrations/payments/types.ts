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

export interface PaymentsClient {
  refund(input: RefundInput): Promise<RefundResult>;
}

export class PaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentsError";
  }
}
