import React, { useEffect } from 'react';

interface JSONLDProps {
  schema: Record<string, any> | Array<Record<string, any>>;
  id?: string;
}

export const JSONLD: React.FC<JSONLDProps> = ({ schema, id = 'jsonld-schema' }) => {
  useEffect(() => {
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }
    };
  }, [schema, id]);

  return null;
};

// Ready-made Schemas
export const getOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://ujrat.ninety5.in/#organization',
  'name': 'Ujrat',
  'url': 'https://ujrat.ninety5.in',
  'logo': 'https://ujrat.ninety5.in/logo.png',
  'sameAs': [
    'https://github.com/ujrat',
    'https://twitter.com/ujrat_in'
  ],
  'description': 'Ujrat is the premium freelance workflow and GST invoicing portal for Indian freelancers, offering dynamic UPI payouts and secure digital contracts.'
});

export const getWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://ujrat.ninety5.in/#website',
  'url': 'https://ujrat.ninety5.in',
  'name': 'Ujrat',
  'description': 'The premium freelance workflow platform for Indian freelancers.',
  'potentialAction': {
    '@type': 'SearchAction',
    'target': {
      '@type': 'EntryPoint',
      'urlTemplate': 'https://ujrat.ninety5.in/search?q={search_term_string}'
    },
    'query-input': 'required name=search_term_string'
  }
});

export const getSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': 'https://ujrat.ninety5.in/#software',
  'name': 'Ujrat',
  'url': 'https://ujrat.ninety5.in',
  'applicationCategory': 'BusinessApplication',
  'operatingSystem': 'All',
  'offers': {
    '@type': 'Offer',
    'price': '0.00',
    'priceCurrency': 'INR'
  },
  'featureList': [
    'Client CRM & Relationship Management',
    'Project Kanban Workflow & Milestone Tracking',
    'Digital Contract Templates & Signatures',
    'Client Brief Gathering Portal',
    'GST-Compliant Invoice Generator',
    'Dynamic UPI Intent & QR Code Payments',
    'Secure Deliverables Download Portal',
    'Activity Logs & Financial Auditing'
  ]
});

export default JSONLD;
