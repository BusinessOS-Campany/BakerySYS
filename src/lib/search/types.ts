export type SearchResult = {
  id: string;
  label: string;
  subtitle: string;
  href: string;
};

export type SearchGroup = {
  groupKey: string;
  results: SearchResult[];
};

export type SearchPayload = {
  query: string;
  groups: SearchGroup[];
};
