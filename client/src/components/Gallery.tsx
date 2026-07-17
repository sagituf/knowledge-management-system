import type { Asset } from "../api.ts";
import { rawUrl } from "../api.ts";

export function Gallery({ assets, onSelect }: { assets: Asset[]; onSelect: (a: Asset) => void }) {
  if (assets.length === 0) {
    return <p className="empty">No assets yet. Upload an image or text file to get started.</p>;
  }
  return (
    <div className="gallery">
      {assets.map((a) => (
        <button key={a.id} className="card" onClick={() => onSelect(a)}>
          {a.kind === "image" ? (
            <img src={rawUrl(a.id)} alt={a.description || a.originalName} loading="lazy" />
          ) : (
            <div className="text-thumb">TXT</div>
          )}
          <div className="card-body">
            <div className="card-name">{a.originalName}</div>
            <div className="card-desc">{a.description || (a.aiGenerated ? "" : "No AI metadata")}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
