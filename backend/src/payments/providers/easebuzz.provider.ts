import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { decryptSecrets } from '../../common/crypto/secret-cipher.util';
import { ServiceProvider } from '../../database/entities';
import { CreatePaymentLinkInput, CreatePaymentLinkResult, PaymentProviderAdapter, PaymentWebhookResult } from './payment-provider.interface';

interface EasebuzzCredentials {
  apiKey: string;
  apiSalt: string;
}

@Injectable()
export class EasebuzzProvider implements PaymentProviderAdapter {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async createPaymentLink(input: CreatePaymentLinkInput, provider: ServiceProvider | null): Promise<CreatePaymentLinkResult> {
    const credentials = this.resolveCredentials(provider);
    if (!credentials) {
      const providerReference = `MOCK-EASEBUZZ-${input.referenceId}`;
      return {
        providerReference,
        paymentUrl: `https://mock-provider.local/easebuzz/${providerReference}`,
        mock: true,
        request: { ...input, mock: true },
        response: { providerReference, mock: true },
      };
    }

    const baseUrl = this.isSandbox(provider) ? 'https://testpay.easebuzz.in' : 'https://pay.easebuzz.in';
    const amount = input.amount.toFixed(2);
    const productinfo = input.purpose || 'Loan repayment';
    // Easebuzz "Initiate Payment" hash sequence: key|txnid|amount|productinfo|firstname|email|udf1..5||||||SALT (SHA-512).
    // Confirm field order/names against Easebuzz's current API reference before taking this live.
    const hashInput = [
      credentials.apiKey,
      input.referenceId,
      amount,
      productinfo,
      input.customerName,
      input.customerEmail,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      credentials.apiSalt,
    ].join('|');
    const hash = createHash('sha512').update(hashInput).digest('hex');

    const requestBody = {
      key: credentials.apiKey,
      txnid: input.referenceId,
      amount,
      productinfo,
      firstname: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
      surl: this.config.get<string>('APP_BASE_URL') ?? 'https://example.com',
      furl: this.config.get<string>('APP_BASE_URL') ?? 'https://example.com',
      hash,
    };

    const response = await firstValueFrom(this.http.post(`${baseUrl}/payment/initiateLink`, requestBody));
    const accessKey = response.data?.data;
    if (response.data?.status !== 1 || !accessKey) {
      throw new Error(`Easebuzz initiate payment failed: ${JSON.stringify(response.data)}`);
    }

    return {
      providerReference: input.referenceId,
      paymentUrl: `${baseUrl}/pay/${accessKey}`,
      mock: false,
      request: requestBody,
      response: response.data,
    };
  }

  verifyWebhook(payload: Record<string, unknown>, provider: ServiceProvider | null): PaymentWebhookResult {
    const credentials = this.resolveCredentials(provider);
    const providerReference = String(payload.txnid ?? '');
    if (!credentials) {
      // Without keys there is nothing to verify against, so unsigned "mock" callbacks are accepted only
      // when explicitly enabled for local/demo use. Otherwise anyone could mark an EMI as paid.
      return {
        verified: payload.mock === true && process.env.ALLOW_MOCK_WEBHOOKS === 'true',
        success: String(payload.status).toUpperCase() === 'SUCCESS',
        providerReference,
        bankReference: (payload.bank_ref_num as string | undefined) ?? null,
        raw: payload,
      };
    }

    const status = String(payload.status ?? '');
    const udfFields = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((index) => String(payload[`udf${index}`] ?? ''));
    // Reverse hash for the transaction webhook: salt|status|udf10..udf1|email|firstname|productinfo|amount|txnid|key (SHA-512).
    const hashInput = [
      credentials.apiSalt,
      status,
      ...udfFields,
      String(payload.email ?? ''),
      String(payload.firstname ?? ''),
      String(payload.productinfo ?? ''),
      String(payload.amount ?? ''),
      providerReference,
      credentials.apiKey,
    ].join('|');
    const expectedHash = createHash('sha512').update(hashInput).digest('hex');
    const verified = expectedHash === payload.hash;

    return {
      verified,
      success: status.toUpperCase() === 'SUCCESS',
      providerReference,
      bankReference: (payload.bank_ref_num as string | undefined) ?? null,
      raw: payload,
    };
  }

  private isSandbox(provider: ServiceProvider | null) {
    return provider?.isSandbox ?? (this.config.get<string>('EASEBUZZ_ENV') ?? 'sandbox') !== 'production';
  }

  private resolveCredentials(provider: ServiceProvider | null): EasebuzzCredentials | null {
    if (provider?.secretsEncrypted) {
      const secrets = decryptSecrets(provider.secretsEncrypted);
      if (secrets.apiKey && secrets.apiSalt) {
        return { apiKey: secrets.apiKey, apiSalt: secrets.apiSalt };
      }
    }
    const apiKey = this.config.get<string>('EASEBUZZ_KEY');
    const apiSalt = this.config.get<string>('EASEBUZZ_SALT');
    if (apiKey && apiSalt) {
      return { apiKey, apiSalt };
    }
    return null;
  }
}
