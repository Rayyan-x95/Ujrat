/**
 * Ujrat Payment System - Provider-Independent Abstraction Types
 * Gateway Independent • UPI Deep Links • Multi-Provider Architecture
 */

export type PaymentRequestStatus =
  | 'pending'
  | 'viewed'
  | 'initiated'
  | 'awaiting_verification'
  | 'verified'
  | 'paid'
  | 'cancelled'
  | 'expired';

export interface PaymentRequestParams {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency?: string;
  payeeVpa: string;
  payeeName: string;
  note?: string;
  clientId?: string;
}

export interface PaymentRequestResult {
  id: string;
  providerId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  payeeVpa: string;
  payeeName: string;
  deepLinkUri: string;
  referenceNumber: string;
  status: PaymentRequestStatus;
  createdAt: string;
}

export interface UPIParams {
  pa: string; // Payee VPA
  pn: string; // Payee Name
  am: number; // Amount
  cu?: string; // Currency (INR)
  tn?: string; // Transaction Note
  tr?: string; // Transaction Reference
  mc?: string; // Merchant Category Code
}

export interface PaymentVerificationParams {
  workspaceId: string;
  profileId: string;
  paymentRequestId?: string;
  invoiceId: string;
  utrNumber: string;
  amount: number;
  verificationStatus: 'approved' | 'rejected';
  notes?: string;
}

export interface PaymentReceiptData {
  id: string;
  receiptNumber: string;
  workspaceId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  utrNumber: string;
  clientName: string;
  issuedAt: string;
}
