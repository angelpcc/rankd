import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, type Profile } from '@/lib/supabase';
import { isMissingTable } from '@/lib/dbState';

// "Lo último que trabajaste" — se lee antes de entrenar, para entrar al gimnasio
// sabiendo qué tocaba mejorar en vez de improvisar.
//
// Todo sale de lo que el peleador ya escribió: `sparring_sessions.what_worked` /
// `to_improve` y las últimas notas de `technique_notes`. No se genera nada ni se
// interpreta: se citan sus propias palabras.

interface Props {
  profile: Profile;
  /** Abrir la pestaña de notas técnicas del Ring. */
  onOpenNotes?: () => void;
}

interface Line { text: string; sourceKey: string; date: string }

const MAX_LINES = 3;

export default function LastWorkedOn({ profile, onOpenNotes }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
  const [lines, setLines] = useState<Line[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [sparRes, noteRes] = await Promise.all([
        supabase.from('sparring_sessions').select('session_date, what_worked, what_didnt')
          .eq('fighter_profile_id', profile.id).order('session_date', { ascending: false }).limit(3),
        supabase.from('technique_notes').select('note_date, title, body')
          .eq('fighter_profile_id', profile.id).order('note_date', { ascending: false }).limit(3),
      ]);
      if (!alive) return;

      const out: Line[] = [];

      if (!isMissingTable(sparRes.error)) {
        (sparRes.data || []).forEach((s) => {
          const row = s as { session_date: string; what_worked: string | null; what_didnt: string | null };
          const improve = (row.what_didnt || '').trim();
          const worked = (row.what_worked || '').trim();
          // "Qué no funcionó" pesa más que "qué funcionó" para preparar el siguiente día.
          if (improve) out.push({ text: improve, sourceKey: 'mc_lw_src_improve', date: row.session_date });
          else if (worked) out.push({ text: worked, sourceKey: 'mc_lw_src_worked', date: row.session_date });
        });
      }

      if (!isMissingTable(noteRes.error)) {
        (noteRes.data || []).forEach((n) => {
          const row = n as { note_date: string; title: string | null; body: string | null };
          const text = (row.title || row.body || '').trim();
          if (text) out.push({ text, sourceKey: 'mc_lw_src_note', date: row.note_date });
        });
      }

      out.sort((a, b) => b.date.localeCompare(a.date));
      setLines(out.slice(0, MAX_LINES));
      setReady(true);
    })();
    return () => { alive = false; };
  }, [profile.id]);

  // Sin nada escrito todavía no se pinta: un bloque vacío aquí no aporta.
  if (!ready || lines.length === 0) return null;

  return (
    <div className="rk-card" style={{ padding: 18 }}>
      <div className="flex items-center justify-between gap-3">
        <p className="rk-label" style={{ color: 'var(--t-2)' }}>{t('mc_lw_title')}</p>
        {onOpenNotes && (
          <button onClick={onOpenNotes} style={{ minHeight: 32 }}
            className="text-xs font-bold cursor-pointer" >
            <span style={{ color: 'var(--accent)' }}>{t('mc_lw_open_notes')}</span>
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-2.5">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex-shrink-0 mt-1.5" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
            <span className="min-w-0">
              <span className="block text-sm leading-snug" style={{ color: 'var(--t-1)' }}>{l.text}</span>
              <span className="block text-[11px] mt-0.5" style={{ color: 'var(--t-3)' }}>
                {t(l.sourceKey)}
                {l.date && ` · ${new Date(l.date + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
