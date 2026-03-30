import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';

@Injectable({ providedIn: 'root' })
export class ScreenshotService {
  async capturePageScreenshot(): Promise<{ blob: Blob; url: string }> {
    const canvas = await html2canvas(document.body, {
      ignoreElements: (el) => el.hasAttribute('data-chatbot-overlay'),
      scale: 1,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))), 'image/png');
    });

    return { blob, url: window.location.href };
  }
}
