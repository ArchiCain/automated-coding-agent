import { Provider } from '@angular/core';
import { DocsService } from './services/docs.service';

export function provideDocs(): Provider[] {
  return [DocsService];
}
