/**
 * Ujrat Payment System - Constants & UPI App Launcher Schemes
 */

export const UTR_REGEX = /^\d{12}$/;

export interface UPIAppConfig {
  id: string;
  name: string;
  schemePrefix: string;
  iconName: string;
  color: string;
}

export const SUPPORTED_UPI_APPS: UPIAppConfig[] = [
  {
    id: 'gpay',
    name: 'Google Pay',
    schemePrefix: 'tez://upi/pay?',
    iconName: 'gpay',
    color: '#4285F4',
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    schemePrefix: 'phonepe://pay?',
    iconName: 'phonepe',
    color: '#5F259F',
  },
  {
    id: 'paytm',
    name: 'Paytm',
    schemePrefix: 'paytmmp://pay?',
    iconName: 'paytm',
    color: '#00BAF2',
  },
  {
    id: 'bhim',
    name: 'BHIM UPI',
    schemePrefix: 'in.org.npci.upiapp://pay?',
    iconName: 'bhim',
    color: '#00529B',
  },
  {
    id: 'cred',
    name: 'CRED Pay',
    schemePrefix: 'cred://pay?',
    iconName: 'cred',
    color: '#000000',
  },
  {
    id: 'amazonpay',
    name: 'Amazon Pay',
    schemePrefix: 'amazonpay://pay?',
    iconName: 'amazon',
    color: '#FF9900',
  },
];
