import { Injectable } from '@nestjs/common';
import { DigioProvider } from './digio.provider';
import { DoqufyProvider } from './doqufy.provider';
import { ESignProviderAdapter } from './esign-provider.interface';
import { MockESignProvider } from './mock.provider';

@Injectable()
export class ESignProviderRegistry {
  constructor(
    private readonly digioProvider: DigioProvider,
    private readonly doqufyProvider: DoqufyProvider,
    private readonly mockProvider: MockESignProvider,
  ) {}

  resolve(providerCode: string | null | undefined): ESignProviderAdapter {
    const code = (providerCode ?? '').toUpperCase();
    if (code.includes('DIGIO')) {
      return this.digioProvider;
    }
    if (code.includes('DOQUFY')) {
      return this.doqufyProvider;
    }
    return this.mockProvider;
  }
}
