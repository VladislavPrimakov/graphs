import type { dict as dictEn } from './dict-en';

export const dict = {
  tokensByRegion: {
    title: 'Globaler Token-Verbrauch nach Regionen (NDB & OpenRouter)',
    kpis: {
      peakDaily: 'Spitzenvolumen',
      topRegion: 'Führende Region',
    },
  },
  tokensByCompany: {
    title: 'Token-Durchsatz nach KI-Anbietern (Offenlegungen & Schätzungen)',
  },
} satisfies typeof dictEn;
