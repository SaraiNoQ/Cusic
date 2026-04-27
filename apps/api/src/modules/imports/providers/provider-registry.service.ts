import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ImportProvider } from './import-provider.interface';
import { JamendoImportProvider } from './jamendo-import.provider';

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly providers = new Map<string, ImportProvider>();

  constructor(
    private readonly jamendoImportProvider: JamendoImportProvider,
  ) {}

  onModuleInit() {
    this.register(this.jamendoImportProvider);
  }

  register(provider: ImportProvider) {
    this.providers.set(provider.name, provider);
  }

  getProvider(name: string): ImportProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  getRegisteredNames(): string[] {
    return [...this.providers.keys()];
  }
}
