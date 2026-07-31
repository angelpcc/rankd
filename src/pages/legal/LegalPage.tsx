import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSEO } from '@/hooks/useSEO';

export interface LegalSection { h: string; p?: string[]; ul?: string[]; }

interface Props {
  title: string;
  updatedLabel: string;
  sections: LegalSection[];
  footerNote: string;
  altHref: string;
  altLabel: string;
  seoDescription: string;
}

// Layout compartido de las páginas legales (términos / privacidad). El contenido
// llega ya en el idioma activo; aquí solo va el marco (barra, título, secciones).
export default function LegalPage({ title, updatedLabel, sections, footerNote, altHref, altLabel, seoDescription }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useSEO({ title: `${title} | RANKD`, description: seoDescription });

  // Convierte correos y URLs sueltas en enlaces, sin HTML embebido.
  const render = (text: string) => {
    const parts = text.split(/(\S+@\S+\.\S+|https?:\/\/\S+)/g);
    return parts.map((part, i) => {
      if (/^\S+@\S+\.\S+$/.test(part)) return <a key={i} href={`mailto:${part}`} className="text-red-400 hover:text-red-300">{part}</a>;
      if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noreferrer" className="text-red-400 hover:text-red-300">{part}</a>;
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="fixed top-0 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <i className="ri-arrow-left-line"></i>{t('lg_back')}
          </button>
          <a href="/" className="flex items-center gap-0 cursor-pointer py-2">
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-white" style={{ letterSpacing: '-0.04em' }}>RAN</span>
            <span className="font-unbounded font-black tracking-tighter leading-none text-[17px] text-[#E10600]" style={{ letterSpacing: '-0.04em' }}>KD</span>
          </a>
          <div className="w-16" />
        </div>
      </div>

      <div className="pt-20 pb-16 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">{title}</h1>
          <p className="text-sm text-zinc-500">{updatedLabel}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-zinc-300 text-sm leading-relaxed">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-bold text-white mb-3">{s.h}</h2>
              {s.p?.map((para, j) => <p key={j} className={j > 0 ? 'mt-2' : ''}>{render(para)}</p>)}
              {s.ul && (
                <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-400">
                  {s.ul.map((li, j) => <li key={j}>{render(li)}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">{footerNote}</p>
          <a href={altHref} className="text-xs text-zinc-500 hover:text-white transition-colors">{altLabel} →</a>
        </div>
      </div>
    </div>
  );
}
