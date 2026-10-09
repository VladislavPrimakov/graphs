import type { meta as enMeta } from './meta-en';

export const meta: typeof enMeta = {
  title: 'Welt',
  description:
    'Vergleichende makroökonomische und energetische Analyse der weltweit führenden Volkswirtschaften: BIP nach Kaufkraftparität (gesamt und pro Kopf), Handelsumsatz mit Maschinen und Elektronik (HS 84-85), Bruttostromerzeugung, Wandel zu sauberer Solar- und Windenergie sowie Stromverbrauch pro Kopf.',
  sections: {
    'gdp-ppp': 'BIP (KKP)',
    'gdp-per-capita-ppp': 'BIP pro Kopf',
    'machinery-turnover': 'Maschinenhandel',
    'electricity-generation': 'Stromerzeugung',
    'clean-power': 'Saubere Energie',
    'electricity-per-capita': 'Strom pro Kopf',
  },
};
