import type { KnipConfig } from 'knip';
import { pipelinesKnip } from './pipelines/knip';
import { siteKnip } from './site/knip';
import { typesKnip } from './types/knip';

const config: KnipConfig = {
  ignoreExportsUsedInFile: true,
  rules: {
    files: 'error',
    dependencies: 'error',
    unlisted: 'error',
    unresolved: 'error',
    exports: 'error',
    types: 'error',
    duplicates: 'error',
  },
  workspaces: {
    site: siteKnip,
    pipelines: pipelinesKnip,
    types: typesKnip,
  },
};

export default config;
