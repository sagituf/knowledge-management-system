import { useEffect, useState } from "react";
import type { Asset } from "../api.ts";
import { rawUrl } from "../api.ts";

export function AssetDetail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (asset.kind === "text") {
      fetch(rawUrl(asset.id))
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText("(failed to load text)"));
    }
  }, [asset]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <h2>{asset.originalName}</h2>
        {asset.kind === "image" ? (
          <img className="detail-img" src={rawUrl(asset.id)} alt={asset.description} />
        ) : (
          <pre className="detail-text">{text}</pre>
        )}
        <section className="meta">
          <h3>Description</h3>
          <p>{asset.description || "—"}</p>
          <h3>Tags</h3>
          <p>{asset.tags.length ? asset.tags.join(", ") : "—"}</p>
          <h3>Keywords</h3>
          <p>{asset.keywords.length ? asset.keywords.join(", ") : "—"}</p>
          {!asset.aiGenerated && <p className="note">AI metadata was not generated for this asset.</p>}
        </section>
      </div>
    </div>
  );
}
