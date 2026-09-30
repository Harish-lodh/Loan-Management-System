import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { decryptSecrets } from '../../common/crypto/secret-cipher.util';
import { ServiceProvider } from '../../database/entities';
import {
  ConfirmSigningStatusResult,
  ConfirmedSignStatus,
  CreateSigningRequestInput,
  CreateSigningRequestResult,
  ESignProviderAdapter,
} from './esign-provider.interface';

interface DoqufyCredentials {
  apiKey: string;
}

// Doqufy eSign API. Endpoint/field names are best-effort placeholders — confirm against Doqufy's
// current API reference (and adjust the base URL/paths below) once sandbox access is available.
@Injectable()
export class DoqufyProvider implements ESignProviderAdapter {
  readonly isMock = false;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async createSigningRequest(input: CreateSigningRequestInput, provider: ServiceProvider | null): Promise<CreateSigningRequestResult> {
    const credentials = this.resolveCredentials(provider);
    if (!credentials) {
      return {
        providerReference: `MOCK-DOQUFY-${input.referenceId}`,
        signingUrl: `https://mock-provider.local/doqufy/${input.referenceId}`,
        mock: true,
        request: { referenceId: input.referenceId, mock: true },
        response: { mock: true },
      };
    }

    const baseUrl = this.baseUrl(provider);
    const requestBody = {
      reference_id: input.referenceId,
      document: { file_name: input.fileName, content_base64: input.documentPdfBase64 },
      signer: { name: input.signerName, email: input.signerEmail, phone: input.signerPhone },
    };

    const response = await firstValueFrom(
      this.http.post(`${baseUrl}/v1/esign/requests`, requestBody, {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      }),
    );
    const documentId = response.data?.document_id ?? response.data?.id;
    const signingUrl = response.data?.signing_url;
    if (!documentId || !signingUrl) {
      throw new Error(`Doqufy create sign request failed: ${JSON.stringify(response.data)}`);
    }

    return {
      providerReference: String(documentId),
      signingUrl,
      mock: false,
      request: { fileName: input.fileName, signerEmail: input.signerEmail },
      response: response.data,
    };
  }

  async confirmStatus(providerRequestId: string, provider: ServiceProvider | null): Promise<ConfirmSigningStatusResult> {
    const credentials = this.resolveCredentials(provider);
    if (!credentials) {
      return { status: 'SIGNED', raw: { mock: true } };
    }
    const baseUrl = this.baseUrl(provider);
    const response = await firstValueFrom(
      this.http.get(`${baseUrl}/v1/esign/requests/${providerRequestId}`, {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      }),
    );
    return { status: this.mapStatus(response.data?.status), raw: response.data };
  }

  private mapStatus(status: string | undefined): ConfirmedSignStatus {
    switch ((status ?? '').toLowerCase()) {
      case 'completed':
      case 'signed':
        return 'SIGNED';
      case 'expired':
        return 'EXPIRED';
      case 'failed':
      case 'declined':
      case 'rejected':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private baseUrl(provider: ServiceProvider | null) {
    return provider?.baseUrl || 'https://api.doqufy.com';
  }

  private resolveCredentials(provider: ServiceProvider | null): DoqufyCredentials | null {
    if (provider?.secretsEncrypted) {
      const secrets = decryptSecrets(provider.secretsEncrypted);
      if (secrets.apiKey) {
        return { apiKey: secrets.apiKey };
      }
    }
    const apiKey = this.config.get<string>('DOQUFY_API_KEY');
    if (apiKey) {
      return { apiKey };
    }
    return null;
  }
}
