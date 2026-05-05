import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const BASE_TITLE = 'RANKD — Plataforma de Scouting para Deportes de Contacto';
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://rankd.es';

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

export function useSEO({ title, description, image, url }: SEOProps = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | RANKD` : BASE_TITLE;
    const fullUrl = url || (typeof window !== 'undefined' ? window.location.href : BASE_URL);

    document.title = fullTitle;

    if (description) {
      setMeta('description', description);
    }

    setMeta('og:title', fullTitle, true);
    setMeta('og:type', 'website', true);
    setMeta('og:url', fullUrl, true);
    setMeta('og:site_name', 'RANKD', true);

    if (description) {
      setMeta('og:description', description, true);
    }

    if (image) {
      setMeta('og:image', image, true);
      setMeta('twitter:image', image);
    }

    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);

    if (description) {
      setMeta('twitter:description', description);
    }

    setCanonical(fullUrl);
  }, [title, description, image, url]);
}
