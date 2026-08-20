export interface InvoiceShareParams {
  invoiceNumber: string;
  total: number;
  dueDate?: string;
  clientPhone?: string;
  portalUrl?: string;
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
    message += `• *Due Date:* ${new Date(dueDate).toLocaleDateString('en-IN')}\n`;
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
