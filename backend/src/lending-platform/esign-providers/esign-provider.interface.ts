import { ServiceProvider } from '../../database/entities';

export interface CreateSigningRequestInput {
  referenceId: string;
  documentPdfBase64: string;
  fileName: string;
  signerName: string;
  signerEmail: string;
  signerPhone: string;
}

export interface CreateSigningRequestResult {
  providerReference: string;
  signingUrl: string;
  mock: boolean;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

export type ConfirmedSignStatus = 'PENDING' | 'SIGNED' | 'FAILED' | 'EXPIRED';

export interface ConfirmSigningStatusResult {
  status: ConfirmedSignStatus;
  raw: Record<string, unknown>;
}

export interface ESignProviderAdapter {
  readonly isMock: boolean;
  createSigningRequest(input: CreateSigningRequestInput, provider: ServiceProvider | null): Promise<CreateSigningRequestResult>;
  confirmStatus(providerRequestId: string, provider: ServiceProvider | null): Promise<ConfirmSigningStatusResult>;
}
