import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Benefits from './components/Benefits';
import Fighters from './components/Fighters';
import Opportunities from './components/Opportunities';
import BrandsSection from './components/Brands';
import Partners from './components/Partners';
import FAQ from './components/FAQ';
import Contact from './components/Contact';
import Footer from './components/Footer';
import SEOContent from '@/components/SEOContent';
import { useSEO } from '@/hooks/useSEO';

export default function HomePage() {
  useSEO({
    title: 'RANKD — La plataforma para peleadores, promotoras y marcas de deportes de combate',
    description: 'RANKD conecta peleadores de boxeo, MMA y kickboxing con promotoras, managers y marcas en España y Latinoamérica. Gratis. Sin comisiones. Sin intermediarios.',
    canonical: 'https://rankd-black.vercel.app/',
    ogImage: 'https://oqsobiykaaqelgfjgsor.supabase.co/storage/v1/object/public/images/0b31c269-e57b-4544-9db5-89b290862f50.png',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'RANKD — La plataforma para peleadores, promotoras y marcas',
      description: 'RANKD conecta peleadores con promotoras y marcas de deportes de combate.',
      url: 'https://rankd-black.vercel.app/',
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://rankd-black.vercel.app/' }]
      }
    }
  });

  return (
    <main className="min-h-screen">
      {/* Contenido indexable por Google — invisible visualmente */}
      <SEOContent />
      <Navbar />
      {/* Narrativa (R12-T15): descubre → cómo funciona → qué te da → quién
          está → conecta → marcas → dudas → únete → contacto */}
      <Hero />
      <HowItWorks />
      <Benefits />
      <Fighters />
      <Opportunities />
      <BrandsSection />
      <FAQ />
      <Partners />
      <Contact />
      <Footer />
    </main>
  );
}
