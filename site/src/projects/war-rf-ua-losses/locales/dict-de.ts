import type { dict as enDict } from './dict-en';

export const dict: typeof enDict = {
  timeline: {
    title: 'Monatliche Dynamik bestätigter Ausrüstungsverluste',
    losses: 'Verluste',
    totalRecords: 'Gesamteinträge in der Datenbank',
    unrecognized: 'nicht zugeordnet',
    monthTotal: 'Gesamt (Monat)',
  },
  categories: {
    title: 'Bestätigte Ausrüstungsverluste nach Kategorien',
    items: {
      tanks: 'Panzer',
      ifv: 'Schützenpanzer & MTW',
      transport: 'Lkw & Transportfahrzeuge',
      sp_artillery: 'Panzerartillerie (SFL)',
      air_defense: 'Luftverteidigung',
      mlrs: 'Mehrfachraketenwerfer',
      towed_artillery: 'Gezogene Artillerie',
      engineering: 'Pionierfahrzeuge',
      radars_jammers: 'Radar & EloKa',
      airplanes: 'Flugzeuge',
      helicopters: 'Hubschrauber',
      vessels: 'Kriegsschiffe & Boote',
      imv: 'Geschützte Fahrzeuge (MRAP)',
      anti_tank: 'Panzerabwehrlenkwaffen',
    },
  },
  map: {
    title: 'Geolokalisierte Karte der Ausrüstungsverluste',
    subtitle: 'Interaktive Visualisierung von über 19.000 foto- und videobestätigten Ausrüstungsverlusten',
    allSides: 'Alle Seiten',
    allCategories: 'Alle Kategorien',
    searchPlaceholder: 'Modell suchen (z. B. T-90M, BMP-3, Ka-52)...',
    selectedModels: 'Ausgewählte Modelle',
    noModelsFound: 'Keine Modelle gefunden',
    losses: 'bestätigte Verluste',
    model: 'Modell',
    side: 'Seite',
    coordinates: 'Koordinaten',
  },
};
