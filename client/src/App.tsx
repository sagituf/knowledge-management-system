import { useCallback, useEffect, useState } from "react";
import type { Asset } from "./api.ts";
import { listAssets, searchAssets } from "./api.ts";
import { UploadPanel } from "./components/UploadPanel.tsx";
import { SearchBar } from "./components/SearchBar.tsx";
import { Gallery } from "./components/Gallery.tsx";
import { AssetDetail } from "./components/AssetDetail.tsx";

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    const data = query.trim() ? await searchAssets(query) : await listAssets();
    setAssets(data);
  }, [query]);

  useEffect(() => {
    refresh().catch(() => setAssets([]));
  }, [refresh]);

  return (
    <main>
      <header className="app-header">
        <h1>Knowledge Management System</h1>
      </header>
      <div className="controls">
        <UploadPanel onUploaded={refresh} onBusyChange={setUploading} />
        <SearchBar value={query} onChange={setQuery} />
      </div>
      {/* Fixed-height row: reserves space so the spinner never shifts the gallery. */}
      <div className="upload-status" aria-live="polite">
        {uploading && (
          <>
            <span className="spinner" role="status" aria-label="Uploading" />
            <span className="upload-status-text">Uploading &amp; analyzing…</span>
          </>
        )}
      </div>
      <Gallery assets={assets} onSelect={setSelected} />
      {selected && (
        <AssetDetail
          asset={selected}
          onClose={() => setSelected(null)}
          onChanged={refresh}
        />
      )}
    </main>
  );
}
