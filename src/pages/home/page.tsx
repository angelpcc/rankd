import Navbar from './components/Navbar';
import Hero from './components/Hero';
import HowItWorks from './components/HowItWorks';
import Fighters from './components/Fighters';
import Opportunities from './components/Opportunities';
import BrandsSection from './components/Brands';
import Partners from './components/Partners';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { useSEO } from '@/hooks/useSEO';

export default function HomePage() {
  useSEO({
    title: 'Donde el talento encuentra oportunidades reales',
    description: 'RANKD conecta peleadores de boxeo y MMA con promotoras, managers y marcas. La plataforma profesional de scouting para deportes de contacto en España.',
  });

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Fighters />
      <Opportunities />
      <BrandsSection />
      <Partners />
      <Contact />
      <Footer />
    </main>
  );
}
