import { ServiceProvider } from '../../database/entities';

export interface CreatePaymentLinkInput {
  referenceId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  purpose: string;
}

export interface CreatePaymentLinkResult {
  providerReference: string;
  paymentUrl: string;
  mock: boolean;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

export interface PaymentWebhookResult {
  verified: boolean;
  success: boolean;
  providerReference: string;
  bankReference?: string | null;
  raw: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  createPaymentLink(input: CreatePaymentLinkInput, provider: ServiceProvider | null): Promise<CreatePaymentLinkResult>;
  verifyWebhook(payload: Record<string, unknown>, provider: ServiceProvider | null): PaymentWebhookResult;
}
