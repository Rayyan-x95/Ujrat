import { formatIndianDate } from '@/shared/utils/date';

export interface InvoiceShareParams {
  invoiceNumber: string;
  total: number;
  dueDate?: string | undefined;
  clientPhone?: string | undefined;
  portalUrl?: string | undefined;
}

export interface ReminderLinkParams {
  phone: string;
  invoiceNo: string;
  amount: number;
  upi?: string | undefined;
  /* Optional consent flag for client-form checkbox (boolean optional, no migration). */
  whatsapp_reminders?: boolean | undefined;
}

export function buildWaMeUrl(phone: string | undefined, message: string): string {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const encoded = encodeURIComponent(message);
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function generateInvoiceWhatsAppUrl(params: InvoiceShareParams): string {
  const { invoiceNumber, total, dueDate, clientPhone, portalUrl } = params;

  let message = `Hello! Here are the billing details for Invoice *#${invoiceNumber}*:\n\n` +
    `• *Amount Due:* ₹${total.toLocaleString('en-IN')}\n`;

  if (dueDate) {
    message += `• *Due Date:* ${formatIndianDate(dueDate)}\n`;
  }

  if (portalUrl) {
    message += `\nYou can review invoice details and complete zero-fee UPI payment securely here:\n${portalUrl}\n`;
  }

  message += `\nThank you for your business!`;
  return buildWaMeUrl(clientPhone, message);
}

export function generatePortalWhatsAppUrl(projectName: string, clientPhone?: string, portalUrl?: string): string {
  let message = `Hello! Here is the secure client portal link for project *${projectName}*:\n\n`;
  if (portalUrl) {
    message += `${portalUrl}\n\n`;
  }
  message += `You can review the project scope, approve proposals, sign agreements, and download deliverables here.\n\nThank you!`;
  return buildWaMeUrl(clientPhone, message);
}

export function buildReminderLink(params: ReminderLinkParams): string {
  const { phone, invoiceNo, amount, upi, whatsapp_reminders } = params;
  let digits = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits && !digits.startsWith('91')) digits = `91${digits}`;
  const consented = whatsapp_reminders !== false;
  let message = consented
    ? `Hi! Gentle reminder: invoice *#${invoiceNo}* of ₹${Number(amount).toLocaleString('en-IN')} is due.` +
      (upi ? `\n\nPay via UPI: ${upi}` : '') +
      `\n\nThank you!`
    : `Hi! Gentle reminder for invoice *#${invoiceNo}*. Please contact us to pay.`;
  const encoded = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
