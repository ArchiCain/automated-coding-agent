export interface DocEntry {
  name: string;
  type: 'file' | 'folder';
  path: string;
}

export interface DocsResponse {
  entries: DocEntry[];
  total: number;
}

export interface DocContent {
  name: string;
  path: string;
  content: string;
}
