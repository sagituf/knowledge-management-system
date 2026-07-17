import { useEffect, useState } from "react";
import type { Asset } from "../api.ts";
import { rawUrl, downloadUrl, deleteAsset } from "../api.ts";

export function AssetDetail({
  asset,
  onClose,
  onChanged,
}: {
  asset: Asset;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset.kind === "text") {
      fetch(rawUrl(asset.id))
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText("(failed to load text)"));
    }
  }, [asset.id, asset.kind]);

  async function handleDelete() {
    if (!window.confirm(`Delete "${asset.originalName}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAsset(asset.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-detail" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <div className="detail-body">
          <div className="detail-left">
            {asset.kind === "image" ? (
              <img className="detail-img" src={rawUrl(asset.id)} alt={asset.description} />
            ) : (
              <pre className="detail-text">{text}</pre>
            )}
          </div>

          <div className="detail-right">
            <h2 className="detail-title">{asset.originalName}</h2>
            <section className="meta">
              <h3>Description</h3>
              <p className={asset.aiGenerated ? undefined : "note"}>{asset.description || "—"}</p>
              <h3>Tags</h3>
              <p>{asset.tags.length ? asset.tags.join(", ") : "—"}</p>
              <h3>Keywords</h3>
              <p>{asset.keywords.length ? asset.keywords.join(", ") : "—"}</p>
            </section>

            <div className="detail-actions">
              <a className="btn" href={downloadUrl(asset.id)} download={asset.originalName}>
                Download
              </a>
              <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
