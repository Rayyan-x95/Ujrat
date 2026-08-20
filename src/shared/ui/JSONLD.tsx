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
  'logo': 'https://ujrat.ninety5.in/favicon-transparent.png',
  'sameAs': [
    'https://github.com/ujrat',
    'https://twitter.com/ujrat_in'
  ],
  'description': 'Ujrat is the free freelance workflow and GST invoicing portal for Indian freelancers, offering dynamic UPI payouts and secure digital contracts.',
  'address': {
    '@type': 'PostalAddress',
    'addressCountry': 'IN'
  },
  'contactPoint': {
    '@type': 'ContactPoint',
    'contactType': 'customer support',
    'email': 'support@ninety5.in',
    'availableLanguage': ['English', 'Hindi']
  }
});

export const getWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://ujrat.ninety5.in/#website',
  'url': 'https://ujrat.ninety5.in',
  'name': 'Ujrat',
  'description': 'The complete free freelance workspace and GST invoicing engine for Indian freelancers.',
  'inLanguage': 'en-IN'
});

export const getSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': 'https://ujrat.ninety5.in/#software',
  'name': 'Ujrat',
  'url': 'https://ujrat.ninety5.in',
  'applicationCategory': 'BusinessApplication',
  'operatingSystem': 'All',
  'inLanguage': 'en-IN',
  'offers': {
    '@type': 'Offer',
    'price': '0.00',
    'priceCurrency': 'INR'
  },
  'featureList': [
    'Client CRM & Relationship Management',
    'Project Kanban Workflow & Milestone Tracking',
    'Digital Contract Templates & Signatures (IT Act 2000)',
    'Client Brief Gathering Portal',
    'GST-Compliant Invoice Generator (CGST, SGST, IGST, SAC 998314)',
    'Zero-Fee Dynamic UPI Intent & QR Code Payments',
    'Secure Deliverables Escrow Download Portal',
    'Activity Logs & Financial Auditing'
  ]
});

export const getTechArticleSchema = (
  headline: string,
  description: string,
  urlPath: string,
  datePublished?: string,
  dateModified?: string
) => {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    'headline': headline,
    'description': description,
    'url': `https://ujrat.ninety5.in${urlPath}`,
    'inLanguage': 'en-IN',
    'spatialCoverage': {
      '@type': 'Place',
      'name': 'India',
      'geo': {
        '@type': 'GeoCoordinates',
        'latitude': 20.593684,
        'longitude': 78.96288
      }
    },
    'author': {
      '@type': 'Organization',
      'name': 'Ujrat Legal & Taxation Engineering Team',
      'url': 'https://ujrat.ninety5.in'
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'Ujrat',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://ujrat.ninety5.in/favicon-transparent.png'
      }
    },
    'mainEntityOfPage': `https://ujrat.ninety5.in${urlPath}`
  };

  if (datePublished) schema['datePublished'] = datePublished;
  if (dateModified) schema['dateModified'] = dateModified;

  return schema;
};

export const getLegalLegislationSchema = (
  lawName: string,
  section: string,
  description: string,
  jurisdiction = 'IN'
) => ({
  '@context': 'https://schema.org',
  '@type': 'Legislation',
  'name': lawName,
  'legislationIdentifier': section,
  'description': description,
  'legislationJurisdiction': jurisdiction,
  'inLanguage': 'en-IN'
});

export const getHowToSchema = (
  name: string,
  description: string,
  steps: Array<{ name: string; text: string }>
) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  'name': name,
  'description': description,
  'inLanguage': 'en-IN',
  'step': steps.map((s, idx) => ({
    '@type': 'HowToStep',
    'position': idx + 1,
    'name': s.name,
    'text': s.text
  }))
});

export const getFAQSchema = (faqs: Array<{ q: string; a: string }>) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  'inLanguage': 'en-IN',
  'mainEntity': faqs.map((faq) => ({
    '@type': 'Question',
    'name': faq.q,
    'acceptedAnswer': {
      '@type': 'Answer',
      'text': faq.a
    }
  }))
});

export const getPricingOfferSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  'name': 'Ujrat Core Workspace',
  'description': 'Free freelance workflow, GST invoicing, UPI payments, and digital contract engine for Indian freelancers.',
  'inLanguage': 'en-IN',
  'brand': {
    '@type': 'Brand',
    'name': 'Ujrat'
  },
  'offers': {
    '@type': 'Offer',
    'price': '0.00',
    'priceCurrency': 'INR',
    'availability': 'https://schema.org/InStock',
    'priceValidUntil': '2030-12-31',
    'url': 'https://ujrat.ninety5.in/pricing'
  }
});

export default JSONLD;
