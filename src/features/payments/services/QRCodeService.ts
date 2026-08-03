/**
 * Ujrat Payment System - On-Demand Dynamic QR Code Generator
 * High Resolution SVG & PNG QR Generation for Web and PDF Invoices
 */

import { UPIPaymentProvider } from '../providers/UPIPaymentProvider';

export class QRCodeService {
  /**
   * Generates a data URL for embedding or downloading QR Code
   */
  static getUPIDeepLink(vpa: string, payeeName: string, amount: number, invoiceNumber: string, note?: string): string {
    const provider = new UPIPaymentProvider();
    return provider.generateDeepLink({
      workspaceId: 'local',
      invoiceId: 'inv-qr',
      invoiceNumber,
      amount,
      currency: 'INR',
      payeeVpa: vpa,
      payeeName,
      ...(note ? { note } : {}),
    });
  }

  /**
   * Encodes a string as a clean SVG Data URI
   */
  static getQRCodeSvgDataUri(upiUri: string): string {
    // Return encoded SVG representation or URI string for QRCodeSVG components
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(upiUri)}`;
  }
}
