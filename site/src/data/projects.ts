import metadata from './metadata.json';

export interface ProjectSource {
  name: string;
  url: string;
}

export interface Project {
  id: string;
  title: string;
  tags: string[];
  description: string;
  path: string;
  sources: ProjectSource[];
  lastUpdated: string;
}

const metaMap = metadata as Record<string, string>;

export const PROJECTS: Project[] = [
  {
    id: 'ua-economic',
    title: 'Ukraine Economic',
    tags: ['ua', 'economy', 'gdp', 'budget'],
    description: 'Annual dynamics of Ukraine’s state budget execution (domestic revenues, defense vs non-defense spending, international grants & loans), gross external debt, nominal GDP share, and foreign trade structure.',
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
    description: 'Long-term macroeconomic and physical industrial comparison of 8 major economies (China, USA, EU, Japan, South Korea, Taiwan, India, Russia): real output deflated by national CPI, power generation, machine tools, and clean energy transition.',
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
    description: 'Historical analysis of orbital spaceflight across seven decades (1958–2026): annual mass of payload capacity delivered to orbit by nation/region and historical cost per kilogram to low Earth orbit.',
    path: '/space-launches/',
    lastUpdated: metaMap['space-launches'] || '',
    sources: [
      { name: 'The Space Devs (Launch Library 2 API)', url: 'https://ll.thespacedevs.com/2.3.0/launches/' },
    ],
  },
  {
    id: 'war-rf-ua-attacks',
    title: 'War RF-UA Attacks',
    tags: ['ua', 'war', 'air defense', 'missiles', 'uav'],
    description: 'Monthly dynamics of strike UAVs (Shahed-136/131 and decoys) and missile strikes categorized into ballistic/aeroballistic and cruise/guided systems launched against Ukraine.',
    path: '/war-rf-ua-attacks/',
    lastUpdated: metaMap['war-rf-ua-attacks'] || '',
    sources: [
      { name: 'Air Force Command of the AFU', url: 'https://t.me/kpszsu' },
      { name: 'Kaggle Dataset (piterfm)', url: 'https://www.kaggle.com/datasets/piterfm/massive-missile-attacks-on-ukraine' },
    ],
  },
  {
    id: 'war-rf-ua-losses',
    title: 'War RF-UA Losses',
    tags: ['ua', 'war', 'losses', 'equipment'],
    description: 'Comparative database of photo- and video-verified heavy military equipment losses across 8 weapon categories, with monthly loss dynamics and system model breakdowns.',
    path: '/war-rf-ua-losses/',
    lastUpdated: metaMap['war-rf-ua-losses'] || '',
    sources: [
      { name: 'LostArmour / WarInUA Verified Map', url: 'https://www.google.com/maps/d/viewer?mid=1dRn8TRMDLRkaaIBJad0YZvTt3dmiuxo' },
    ],
  },
];

export function getProject(id: string): Project {
  const proj = PROJECTS.find((p) => p.id === id);
  if (!proj) {
    throw new Error(`Project not found with id: ${id}`);
  }
  return proj;
}

export const ALL_UNIQUE_TAGS = Array.from(
  new Set(PROJECTS.flatMap((p) => p.tags))
).sort();
