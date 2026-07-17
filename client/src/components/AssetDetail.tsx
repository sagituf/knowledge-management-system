import { useEffect, useRef, useState } from "react";
import type { Asset } from "../api.ts";
import { rawUrl, downloadUrl, deleteAsset } from "../api.ts";
import { errorMessage } from "../util.ts";

const TITLE_ID = "asset-detail-title";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function AssetDetail({
  asset,
  onClose,
  onChanged,
}: {
  asset: Asset;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete() {
    if (!window.confirm(`Delete "${asset.originalName}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAsset(asset.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(errorMessage(e, "delete failed"));
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" aria-label="Close" onClick={onClose} ref={closeButtonRef}>
          ×
        </button>
        <div className="detail-body">
          <div className="detail-left">
            {asset.kind === "image" ? (
              <img
                className="detail-img"
                src={rawUrl(asset.id)}
                alt={asset.description || asset.originalName}
              />
            ) : (
              <pre className="detail-text">{asset.extractedText}</pre>
            )}
          </div>

          <div className="detail-right">
            <h2 className="detail-title" id={TITLE_ID}>{asset.originalName}</h2>
            <section className="meta">
              <h3>Description</h3>
              <p className={asset.aiGenerated ? undefined : "note"}>{asset.description || "—"}</p>
              <h3>Tags</h3>
              <p>{asset.tags.length ? asset.tags.join(", ") : "—"}</p>
              <h3>Keywords</h3>
              <p>{asset.keywords.length ? asset.keywords.join(", ") : "—"}</p>
              <h3>File</h3>
              <p>
                {asset.mimeType} · {formatSize(asset.sizeBytes)} · uploaded {formatDate(asset.createdAt)}
              </p>
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
