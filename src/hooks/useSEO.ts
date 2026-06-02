import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  jsonLd?: object;
}

const BASE_URL = 'https://rankd-black.vercel.app';

export function useSEO({ title, description, canonical, ogImage, jsonLd }: SEOProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Helpers
    const setMeta = (selector: string, value: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        const attr = selector.includes('property=') ? 'property' : 'name';
        el.setAttribute(attr, selector.match(/["']([^"']+)["']/)?.[1] || '');
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
      el.setAttribute('href', href);
    };

    // Meta tags
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:url"]', canonical || BASE_URL);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);

    if (ogImage) {
      setMeta('meta[property="og:image"]', ogImage);
      setMeta('meta[name="twitter:image"]', ogImage);
    }

    // Canonical
    setLink('canonical', canonical || `${BASE_URL}${window.location.pathname}`);

    // JSON-LD dinámico
    if (jsonLd) {
      let script = document.querySelector('#dynamic-jsonld') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'dynamic-jsonld';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      const script = document.querySelector('#dynamic-jsonld');
      if (script) script.remove();
    };
  }, [title, description, canonical, ogImage, jsonLd]);
}
