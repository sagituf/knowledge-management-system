export type AssetKind = "image" | "text";

export interface Asset {
  id: string;
  kind: AssetKind;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  description: string;
  tags: string[];
  keywords: string[];
  extractedText: string;
  aiGenerated: boolean;
}

export interface GeneratedMetadata {
  description: string;
  tags: string[];
  keywords: string[];
}
