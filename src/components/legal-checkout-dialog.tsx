'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, FileText, ShieldCheck } from 'lucide-react';
import { LEGAL_VERSIONS, type LegalAcceptanceInput } from '@/lib/legal-versions';

type Flow = 'GYM_SAAS' | 'PERSONAL_PLUS';

export function LegalCheckoutDialog({
  open,
  flow,
  planName,
  price,
  released,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  flow: Flow;
  planName: string;
  price: string;
  released: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (acceptance: LegalAcceptanceInput) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [accepted, setAccepted] = useState({
    contract: false,
    terms: false,
    privacy: false,
    recurring: false,
  });
  const contract = flow === 'GYM_SAAS' ? LEGAL_VERSIONS.ownerContract : LEGAL_VERSIONS.personalContract;
  const allAccepted = Object.values(accepted).every(Boolean);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (open) setAccepted({ contract: false, terms: false, privacy: false, recurring: false });
  }, [open, flow, planName]);

  const toggle = (key: keyof typeof accepted) =>
    setAccepted((current) => ({ ...current, [key]: !current[key] }));

  const handleConfirm = () => {
    if (!allAccepted || !released || busy) return;
    onConfirm({
      contract: contract.version,
      terms: LEGAL_VERSIONS.terms.version,
      privacy: LEGAL_VERSIONS.privacy.version,
      contractAccepted: true,
      termsAccepted: true,
      privacyAcknowledged: true,
      recurringPayment: true,
    });
  };

  return (
    <dialog
      ref={dialog}
      className="dialog legal-checkout-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <span className="settings-kicker">Antes de continuar</span>
          <h2>Confirma tu suscripción</h2>
        </div>
        <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="legal-order-summary">
        <span>{planName}</span>
        <strong>{price} <small>MXN / mes</small></strong>
        <p>El siguiente cobro se realizará en la fecha de renovación que muestre Mercado Pago.</p>
      </div>
      <div className="legal-doc-links">
        <Link href={contract.url} target="_blank" rel="noreferrer">
          <FileText size={17} /> Contrato de {flow === 'GYM_SAAS' ? 'servicio Gymia' : 'Gymia Plus personal'}
        </Link>
        <Link href={LEGAL_VERSIONS.terms.url} target="_blank" rel="noreferrer">
          <FileText size={17} /> Términos y Condiciones
        </Link>
        <Link href={LEGAL_VERSIONS.privacy.url} target="_blank" rel="noreferrer">
          <ShieldCheck size={17} /> Aviso de Privacidad
        </Link>
      </div>
      <div className="legal-consent-list">
        <label>
          <input type="checkbox" checked={accepted.contract} onChange={() => toggle('contract')} />
          <span>Acepto el contrato de suscripción del plan seleccionado.</span>
        </label>
        <label>
          <input type="checkbox" checked={accepted.terms} onChange={() => toggle('terms')} />
          <span>Acepto los Términos y Condiciones de Gymia.</span>
        </label>
        <label>
          <input type="checkbox" checked={accepted.privacy} onChange={() => toggle('privacy')} />
          <span>Confirmo que leí el Aviso de Privacidad.</span>
        </label>
        <label>
          <input type="checkbox" checked={accepted.recurring} onChange={() => toggle('recurring')} />
          <span>
            Autorizo expresamente el cobro automático recurrente de {price} MXN cada mes hasta que
            cancele. Recibiré el aviso de renovación con al menos cinco días naturales y podré
            cancelar de inmediato desde mi cuenta.
          </span>
        </label>
      </div>
      {!released && (
        <p className="legal-release-notice" role="status">
          El pago se habilitará cuando estén aprobados los documentos, el correo y SMS de
          verificación, y el aviso automático de renovación esté configurado en producción.
        </p>
      )}
      <div className="dialog-actions">
        <button className="button secondary" type="button" onClick={onClose} disabled={busy}>
          Volver
        </button>
        <button
          className="button primary"
          type="button"
          onClick={handleConfirm}
          disabled={!allAccepted || !released || busy}
        >
          {busy ? 'Preparando pago…' : <><Check size={16} /> Aceptar y pagar</>}
        </button>
      </div>
    </dialog>
  );
}
