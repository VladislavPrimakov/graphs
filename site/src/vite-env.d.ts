declare module 'virtual:changelog' {
  export const changelogData: {
    html: string;
    releases: {
      version: string;
      date?: string;
    }[];
  };
}
