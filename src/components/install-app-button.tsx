'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'other'>('other');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos =
      /iphone|ipad|ipod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setPlatform(isIos ? 'ios' : 'other');
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => {});

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setHelpOpen(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setPrompt(null);
      return;
    }
    setHelpOpen(true);
  }

  if (installed) return null;

  return (
    <>
      <button className="install-app-button" onClick={() => void install()} aria-haspopup="dialog">
        <Download size={16} /> <span>Instalar Gymia</span>
      </button>
      {helpOpen && (
        <div
          className="install-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <section
            className="install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <button
              className="install-close"
              aria-label="Cerrar"
              onClick={() => setHelpOpen(false)}
            >
              <X size={18} />
            </button>
            <span className="install-dialog-icon">
              <Download size={22} />
            </span>
            <span className="eyebrow">GYMIA EN TUS DISPOSITIVOS</span>
            <h2 id="install-title">Agrega Gymia a tu pantalla de inicio</h2>
            {platform === 'ios' ? (
              <ol>
                <li>Abre esta página en Safari.</li>
                <li>
                  Toca <strong>Compartir</strong> en la barra del navegador.
                </li>
                <li>
                  Elige <strong>Agregar a pantalla de inicio</strong> y confirma.
                </li>
              </ol>
            ) : (
              <p>
                Abre el menú del navegador y elige <strong>Instalar Gymia</strong> o{' '}
                <strong>Agregar a pantalla de inicio</strong>. En algunos navegadores esta opción
                aparece junto a la barra de direcciones.
              </p>
            )}
            <button className="button primary wide" onClick={() => setHelpOpen(false)}>
              Entendido
            </button>
          </section>
        </div>
      )}
    </>
  );
}
