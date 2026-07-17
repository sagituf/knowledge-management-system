export interface Asset {
  id: string;
  kind: "image" | "text";
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

export async function listAssets(): Promise<Asset[]> {
  const r = await fetch("/api/assets");
  if (!r.ok) throw new Error("failed to list assets");
  return r.json();
}

export async function searchAssets(q: string): Promise<Asset[]> {
  const r = await fetch(`/api/assets/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("search failed");
  return r.json();
}

export async function uploadAsset(file: File): Promise<Asset> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/assets", { method: "POST", body: form });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? "upload failed");
  }
  return r.json();
}

export async function deleteAsset(id: string): Promise<void> {
  const r = await fetch(`/api/assets/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("delete failed");
}

export function rawUrl(id: string): string {
  return `/api/assets/${id}/raw`;
}

export function downloadUrl(id: string): string {
  return `/api/assets/${id}/download`;
}
