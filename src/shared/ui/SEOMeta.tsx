import React, { useEffect } from 'react';

interface SEOMetaProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
}

export const SEOMeta: React.FC<SEOMetaProps> = ({
  title,
  description,
  canonicalPath = '',
  ogType = 'website',
  ogImage = '/og-image.png',
}) => {
  useEffect(() => {
    // 1. Update Title
    const fullTitle = `${title} | Ujrat`;
    document.title = fullTitle;

    // Helper to update or create meta tag
    const updateMetaTag = (attr: string, value: string, content: string) => {
      let element = document.querySelector(`meta[${attr}="${value}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, value);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Update Meta Description
    updateMetaTag('name', 'description', description);

    // 3. Update Canonical URL
    const baseUrl = 'https://ujrat.ninety5.in';
    const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const canonicalUrl = `${baseUrl}${cleanPath === '/' ? '' : cleanPath}`;
    
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 4. Update OpenGraph Tags
    updateMetaTag('property', 'og:title', fullTitle);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('property', 'og:type', ogType);
    updateMetaTag('property', 'og:image', ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`);

    // 5. Update Twitter Cards
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', fullTitle);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage}`);
  }, [title, description, canonicalPath, ogType, ogImage]);

  return null; // Side-effect only component
};

export default SEOMeta;
