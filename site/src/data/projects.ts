import metadata from './metadata.json';
import type { Project, ProjectSlug } from '@/types';

export type { Project, ProjectSource, ProjectSlug } from '@/types';

const metaMap: Record<string, string> = metadata;

/** Master registry of all interactive dashboard projects in the catalog. */
export const PROJECTS: Project[] = [
  {
    id: 'ua-economic',
    title: 'Ukraine Economic',
    tags: ['ua', 'economy', 'gdp', 'budget'],
    description:
      'Annual dynamics of Ukraine’s state budget execution (domestic revenues, defense vs non-defense spending, international grants & loans), gross external debt, nominal GDP share, and foreign trade structure.',
    path: '/ua-economic/',
    lastUpdated: metaMap['ua-economic'] || '',
    sources: [
      { name: 'National Bank of Ukraine (NBU)', url: 'https://bank.gov.ua/' },
      { name: 'Ministry of Finance of Ukraine', url: 'https://mof.gov.ua/' },
    ],
  },
  {
    id: 'world-economic',
    title: 'World Economic',
    tags: ['global', 'economy', 'gdp', 'energy', 'industry'],
    description:
      'Long-term macroeconomic and physical industrial comparison of 8 major economies (China, USA, EU, Japan, South Korea, Taiwan, India, Russia): real output deflated by national CPI, power generation, machine tools, and clean energy transition.',
    path: '/world-economic/',
    lastUpdated: metaMap['world-economic'] || '',
    sources: [
      { name: 'DBnomics (World Bank & IMF)', url: 'https://db.nomics.world/' },
      { name: 'UN Comtrade Database', url: 'https://comtradeplus.un.org/' },
      { name: 'Our World in Data Energy', url: 'https://ourworldindata.org/energy' },
    ],
  },
  {
    id: 'space-launches',
    title: 'Space Launches',
    tags: ['global', 'space', 'launches'],
    description:
      'Historical analysis of orbital spaceflight across seven decades (1958–2026): annual mass of payload capacity delivered to orbit by nation/region and historical cost per kilogram to low Earth orbit.',
    path: '/space-launches/',
    lastUpdated: metaMap['space-launches'] || '',
    sources: [{ name: 'The Space Devs (Launch Library 2 API)', url: 'https://ll.thespacedevs.com/2.3.0/launches/' }],
  },
  {
    id: 'war-rf-ua-attacks',
    title: 'War RF-UA Attacks',
    tags: ['rf', 'ua', 'war', 'air defense', 'missiles', 'uav'],
    description: 'Comparative monthly and daily dynamics of strike UAVs and missile strikes (ballistic and cruise systems) between Russia and Ukraine.',
    path: '/war-rf-ua-attacks/',
    lastUpdated: metaMap['war-rf-ua-attacks'] || '',
    sources: [
      { name: 'Kaggle Dataset (piterfm)', url: 'https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine' },
      { name: 'Telegram @mod_russia_en', url: 'https://t.me/mod_russia_en' },
    ],
  },
  {
    id: 'war-rf-ua-losses',
    title: 'War RF-UA Losses',
    tags: ['rf', 'ua', 'war', 'losses', 'equipment'],
    description: 'Comparative database of photo- and video-verified heavy military equipment losses across 8 weapon categories, with monthly loss dynamics and system model breakdowns.',
    path: '/war-rf-ua-losses/',
    lastUpdated: metaMap['war-rf-ua-losses'] || '',
    sources: [{ name: 'LostArmour / WarInUA Verified Map', url: 'https://www.google.com/maps/d/viewer?mid=1dRn8TRMDLRkaaIBJad0YZvTt3dmiuxo' }],
  },
];

/** Retrieves project metadata and configuration by slug identifier. */
export function getProject(id: ProjectSlug | string): Project {
  const proj = PROJECTS.find((p) => p.id === id);
  if (!proj) {
    throw new Error(`Project not found with id: ${id}`);
  }
  return proj;
}

/** Alphabetically sorted list of all unique category tags used across projects. */
export const ALL_UNIQUE_TAGS: string[] = Array.from(new Set(PROJECTS.flatMap((p) => p.tags))).sort();
