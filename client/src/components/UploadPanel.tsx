import { useState } from "react";
import { uploadAsset } from "../api.ts";

export function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file);
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-panel">
      <label className="upload-btn">
        {busy ? "Uploading…" : "Upload files"}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,text/*,.txt,.md"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          hidden
        />
      </label>
      <span className="hint">Text files or JPEG/PNG/GIF/WEBP images</span>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
