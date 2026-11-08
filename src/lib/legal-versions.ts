export const LEGAL_VERSIONS = {
  ownerContract: {
    type: 'OWNER_SAAS_CONTRACT',
    version: 'gymia-owner-v1.2-2026-11-07',
    url: '/legal/v1.2/contrato-gimnasios.html',
  },
  personalContract: {
    type: 'PERSONAL_PLUS_CONTRACT',
    version: 'gymia-plus-v1.2-2026-11-07',
    url: '/legal/v1.2/contrato-plus-personal.html',
  },
  terms: {
    type: 'TERMS_OF_USE',
    version: 'gymia-terms-v1.2-2026-11-07',
    url: '/legal/v1.2/terminos-condiciones.html',
  },
  privacy: {
    type: 'PRIVACY_NOTICE',
    version: 'gymia-privacy-v1.2-2026-11-07',
    url: '/legal/v1.2/aviso-privacidad.html',
  },
} as const;

export type LegalAcceptanceInput = {
  contract: string;
  terms: string;
  privacy: string;
  contractAccepted: true;
  termsAccepted: true;
  privacyAcknowledged: true;
  recurringPayment: true;
};

export const legalCheckoutSchema = {
  contract: (version: string) => version === LEGAL_VERSIONS.ownerContract.version || version === LEGAL_VERSIONS.personalContract.version,
  terms: (version: string) => version === LEGAL_VERSIONS.terms.version,
  privacy: (version: string) => version === LEGAL_VERSIONS.privacy.version,
};
