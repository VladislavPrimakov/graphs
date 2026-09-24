/** Valid unique URL slugs for all interactive visualization projects in the catalog. */
export type ProjectSlug = 'ua-economic' | 'world-economic' | 'space-launches' | 'war-rf-ua-attacks' | 'war-rf-ua-losses';

/** Data provider or official agency citation for dataset provenance. */
export interface ProjectSource {
  /** Name of the organization or data provider. */
  name: string;
  /** Direct URL to the official source repository or dataset portal. */
  url: string;
}

/** Registry entry defining a dashboard project, metadata, and routing information. */
export interface Project {
  /** Unique project slug identifier. */
  id: ProjectSlug;
  /** Human-readable title displayed in headers and navigation catalog. */
  title: string;
  /** Categorization and discovery tags for catalog filtering. */
  tags: string[];
  /** Detailed summary of metrics, methodology, and visualizations. */
  description: string;
  /** Root route path for the visualization page. */
  path: string;
  /** List of primary sources and statistical agencies cited. */
  sources: ProjectSource[];
  /** ISO date string or formatted timestamp of the latest ETL pipeline execution. */
  lastUpdated: string;
}
