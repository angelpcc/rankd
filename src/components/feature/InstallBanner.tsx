import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import RankdLogo from '@/components/base/RankdLogo';

/** Evento de instalación de Chrome/Edge. No está en los tipos estándar. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'rankd_pwa_dismissed_at';
// Si lo cierra, no se le vuelve a enseñar en dos semanas.
const DISMISS_DAYS = 14;
// Tampoco aparece nada más entrar: primero que vea algo de la plataforma.
const DELAY_MS = 12000;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    // iOS usa una propiedad propia fuera del estándar
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function detectPlatform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // iPadOS moderno se identifica como Mac: se distingue por el táctil
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

/**
 * Invitación a instalar RANKD en la pantalla de inicio.
 *
 * Solo aparece en móvil, solo si no está ya instalada y solo si no la cerró
 * hace poco. En Android usa el flujo nativo del navegador cuando está
 * disponible; en iPhone no existe ese flujo, así que se explican los pasos
 * reales (Compartir → Añadir a pantalla de inicio).
 */
export default function InstallBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    // En escritorio no molestamos, y si ya está instalada tampoco.
    const p = detectPlatform();
    setPlatform(p);
    if (p === 'other' || isStandalone() || recentlyDismissed()) return;

    // Chrome/Edge avisan de que la instalación es posible: guardamos el evento
    // para poder lanzar el diálogo nativo cuando el usuario lo pida.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // Si la instala, el banner desaparece para siempre
    const onInstalled = () => {
      setVisible(false);
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* modo privado */ }
    };
    window.addEventListener('appinstalled', onInstalled);

    const timer = window.setTimeout(() => setVisible(true), DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setShowSteps(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* modo privado */ }
  }, []);

  const install = useCallback(async () => {
    // Android con flujo nativo disponible: lo lanzamos directamente
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') dismiss();
      return;
    }
    // iPhone (y Android sin evento): hay que explicar los pasos a mano
    setShowSteps(true);
  }, [deferred, dismiss]);

  if (!visible) return null;

  const steps = platform === 'ios'
    ? { title: t('pwa_ios_title'), icon: 'ri-share-box-line', items: [t('pwa_ios_1'), t('pwa_ios_2'), t('pwa_ios_3')] }
    : { title: t('pwa_android_title'), icon: 'ri-more-2-fill', items: [t('pwa_android_1'), t('pwa_android_2'), t('pwa_android_3')] };

  return (
    <>
      {/* ── Banner ── */}
      <div
        className="rk-install-banner"
        style={{
          position: 'fixed', left: 12, right: 12,
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          zIndex: 10040,
          background: 'linear-gradient(135deg, rgba(14,14,14,0.98) 0%, rgba(8,8,8,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 18,
          boxShadow: '0 18px 50px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(20px)',
          padding: '13px 13px 14px 15px',
          display: 'flex', flexDirection: 'column', gap: 11,
        }}
      >
        {/* Filo rojo de marca */}
        <span style={{ position: 'absolute', top: 0, left: 18, width: 54, height: 3, background: '#E10600', borderRadius: '0 0 3px 3px' }} />

        {/* Fila 1: logo + texto + cerrar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, flexShrink: 0, borderRadius: 11,
            background: 'rgba(225,6,0,0.1)', border: '1px solid rgba(225,6,0,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RankdLogo size={20} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15.5, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 }}>
              {t('pwa_title')}
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12.5, color: 'rgba(255,255,255,0.55)', margin: '2px 0 0', lineHeight: 1.35 }}>
              {t('pwa_sub')}
            </p>
          </div>

          {/* Cerrar: 40px de zona de toque, cómoda con el dedo */}
          <button
            onClick={dismiss}
            aria-label={t('pwa_close')}
            style={{
              flexShrink: 0, alignSelf: 'flex-start', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
            }}
          >
            <i className="ri-close-line" style={{ fontSize: 19 }} />
          </button>
        </div>

        {/* Fila 2: acción a todo el ancho — objetivo de toque generoso */}
        <button
          onClick={install}
          style={{
            width: '100%', background: '#E10600', color: '#fff', border: 'none',
            borderRadius: 11, padding: '12px 16px', cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700,
            letterSpacing: 1.5, whiteSpace: 'nowrap',
            boxShadow: '0 4px 18px rgba(225,6,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <i className={deferred ? 'ri-download-2-line' : 'ri-share-box-line'} style={{ fontSize: 15 }} />
          {deferred ? t('pwa_install') : t('pwa_how')}
        </button>
      </div>

      {/* ── Pasos (iPhone, o Android sin flujo nativo) ── */}
      {showSteps && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowSteps(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10045,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            className="anim-fade-up"
            style={{
              width: '100%', maxWidth: 460,
              background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '22px 22px 0 0',
              padding: `24px 22px calc(28px + env(safe-area-inset-bottom, 0px))`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: 'rgba(225,6,0,0.12)', border: '1px solid rgba(225,6,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={steps.icon} style={{ color: '#E10600', fontSize: 18 }} />
              </div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1.5, color: '#fff', margin: 0 }}>
                {steps.title}
              </p>
            </div>

            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.items.map((item, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    width: 25, height: 25, flexShrink: 0, borderRadius: 8,
                    background: 'rgba(225,6,0,0.12)', border: '1px solid rgba(225,6,0,0.3)',
                    color: '#E10600', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'system-ui, sans-serif',
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.45 }}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>

            <button
              onClick={dismiss}
              style={{
                width: '100%', background: '#E10600', color: '#fff', border: 'none',
                borderRadius: 12, padding: '15px', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 1.5,
              }}
            >
              {t('pwa_got_it')}
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* Refuerzo: en pantallas grandes no se muestra bajo ninguna circunstancia */
        @media (min-width: 861px) { .rk-install-banner { display: none !important; } }
      `}</style>
    </>
  );
}
