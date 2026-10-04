import type { WarLossCategory } from '@/types';

export const dict = {
  timeline: {
    title: 'Monthly Timeline of Confirmed Equipment Losses',
    losses: 'Losses',
    totalRecords: 'Total Database Records',
    unrecognized: 'unrecognized',
    monthTotal: 'Total (Month)',
  },
  categories: {
    title: 'Confirmed Equipment Losses by Category',
    items: {
      tanks: 'Tanks',
      ifv: 'IFVs & APCs',
      transport: 'Trucks & Transport',
      sp_artillery: 'Self-Propelled Artillery',
      air_defense: 'Air Defense',
      mlrs: 'MLRS',
      towed_artillery: 'Towed Artillery',
      engineering: 'Engineering Vehicles',
      radars_jammers: 'Radars & EW',
      airplanes: 'Aircraft',
      helicopters: 'Helicopters',
      vessels: 'Naval Vessels',
      imv: 'Infantry Mobility Vehicles',
      anti_tank: 'Anti-Tank Systems',
    } satisfies Record<WarLossCategory, string>,
  },
  map: {
    title: 'Geolocated Equipment Losses Map',
    subtitle: 'Interactive visualization of 19,000+ photo- and video-verified equipment losses',
    allSides: 'All Sides',
    allCategories: 'All Categories',
    searchPlaceholder: 'Search model (e.g. T-90M, BMP-3, Ka-52)...',
    selectedModels: 'Selected Models',
    noModelsFound: 'No models found',
    losses: 'verified losses',
    model: 'Model',
    side: 'Side',
    coordinates: 'Coordinates',
  },
};
