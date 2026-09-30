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

interface DigioCredentials {
  clientId: string;
  clientSecret: string;
}

// Digio's Document eSign API (documentation.digio.in/digisign). Endpoints/field names below are
// best-effort from public docs and should be confirmed against a live sandbox before going to production.
@Injectable()
export class DigioProvider implements ESignProviderAdapter {
  readonly isMock = false;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async createSigningRequest(input: CreateSigningRequestInput, provider: ServiceProvider | null): Promise<CreateSigningRequestResult> {
    const credentials = this.resolveCredentials(provider);
    if (!credentials) {
      return {
        providerReference: `MOCK-DIGIO-${input.referenceId}`,
        signingUrl: `https://mock-provider.local/digio/${input.referenceId}`,
        mock: true,
        request: { referenceId: input.referenceId, mock: true },
        response: { mock: true },
      };
    }

    const baseUrl = this.baseUrl(provider);
    const requestBody = {
      file_name: input.fileName,
      file_data: input.documentPdfBase64,
      signers: [
        {
          identifier: input.signerEmail,
          name: input.signerName,
          reason: 'Loan agreement execution',
        },
      ],
      expire_in_days: 3,
      display_on_page: 'all',
      notify_signers: true,
      generate_access_token: true,
    };

    const response = await firstValueFrom(
      this.http.post(`${baseUrl}/v2/client/document/uploadpdf`, requestBody, {
        auth: { username: credentials.clientId, password: credentials.clientSecret },
      }),
    );
    const documentId = response.data?.id;
    const signingParty = response.data?.signing_parties?.[0];
    const accessToken = signingParty?.access_token?.id;
    if (!documentId) {
      throw new Error(`Digio create sign request failed: ${JSON.stringify(response.data)}`);
    }

    return {
      providerReference: documentId,
      signingUrl: `https://ext.digio.in/#/gateway/login/${documentId}/${encodeURIComponent(input.signerEmail)}/${accessToken ?? ''}`,
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
      this.http.get(`${baseUrl}/v2/client/document/${providerRequestId}`, {
        auth: { username: credentials.clientId, password: credentials.clientSecret },
      }),
    );
    return { status: this.mapStatus(response.data?.agreement_status), raw: response.data };
  }

  private mapStatus(agreementStatus: string | undefined): ConfirmedSignStatus {
    switch (agreementStatus) {
      case 'completed':
      case 'signed':
        return 'SIGNED';
      case 'expired':
        return 'EXPIRED';
      case 'failed':
      case 'declined':
        return 'FAILED';
      default:
        return 'PENDING';
    }
  }

  private baseUrl(provider: ServiceProvider | null) {
    return provider?.baseUrl || 'https://api.digio.in';
  }

  private resolveCredentials(provider: ServiceProvider | null): DigioCredentials | null {
    if (provider?.secretsEncrypted) {
      const secrets = decryptSecrets(provider.secretsEncrypted);
      if (secrets.clientId && secrets.clientSecret) {
        return { clientId: secrets.clientId, clientSecret: secrets.clientSecret };
      }
    }
    const clientId = this.config.get<string>('DIGIO_CLIENT_ID');
    const clientSecret = this.config.get<string>('DIGIO_CLIENT_SECRET');
    if (clientId && clientSecret) {
      return { clientId, clientSecret };
    }
    return null;
  }
}
