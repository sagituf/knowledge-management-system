import { useEffect, useState } from "react";
import type { Asset } from "../api.ts";
import { rawUrl, reevaluateAsset, deleteAsset } from "../api.ts";

export function AssetDetail({
  asset,
  onClose,
  onChanged,
}: {
  asset: Asset;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState<Asset>(asset);
  const [text, setText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(asset);
  }, [asset]);

  useEffect(() => {
    if (current.kind === "text") {
      fetch(rawUrl(current.id))
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText("(failed to load text)"));
    }
  }, [current.id, current.kind]);

  async function handleReevaluate() {
    setBusy(true);
    setError(null);
    try {
      const updated = await reevaluateAsset(current.id);
      setCurrent(updated);
      onChanged();
      if (!updated.aiGenerated) {
        setError("AI could not generate metadata (check the API key / credit balance).");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "re-evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${current.originalName}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAsset(current.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <h2>{current.originalName}</h2>
        {current.kind === "image" ? (
          <img className="detail-img" src={rawUrl(current.id)} alt={current.description} />
        ) : (
          <pre className="detail-text">{text}</pre>
        )}

        <div className="detail-actions">
          <button className="btn" onClick={handleReevaluate} disabled={busy}>
            {busy ? "Working…" : "Re-evaluate with AI"}
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={busy}>
            Delete
          </button>
        </div>
        {error && <p className="error">{error}</p>}

        <section className="meta">
          <h3>Description</h3>
          <p>{current.description || "—"}</p>
          <h3>Tags</h3>
          <p>{current.tags.length ? current.tags.join(", ") : "—"}</p>
          <h3>Keywords</h3>
          <p>{current.keywords.length ? current.keywords.join(", ") : "—"}</p>
          {!current.aiGenerated && (
            <p className="note">AI metadata was not generated for this asset.</p>
          )}
        </section>
      </div>
    </div>
  );
}
