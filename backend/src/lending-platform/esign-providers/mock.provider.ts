import { Injectable } from '@nestjs/common';
import {
  ConfirmSigningStatusResult,
  CreateSigningRequestInput,
  CreateSigningRequestResult,
  ESignProviderAdapter,
} from './esign-provider.interface';

@Injectable()
export class MockESignProvider implements ESignProviderAdapter {
  readonly isMock = true;

  async createSigningRequest(input: CreateSigningRequestInput): Promise<CreateSigningRequestResult> {
    return {
      providerReference: input.referenceId,
      signingUrl: `https://mock-provider.local/esign/${input.referenceId}`,
      mock: true,
      request: { referenceId: input.referenceId, mock: true },
      response: { referenceId: input.referenceId, signingUrl: `https://mock-provider.local/esign/${input.referenceId}` },
    };
  }

  async confirmStatus(): Promise<ConfirmSigningStatusResult> {
    return { status: 'SIGNED', raw: { mock: true } };
  }
}
