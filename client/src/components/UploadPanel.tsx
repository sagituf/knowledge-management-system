import { useState } from "react";
import { uploadAsset } from "../api.ts";
import { errorMessage } from "../util.ts";

export function UploadPanel({
  onUploaded,
  onBusyChange,
}: {
  onUploaded: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file);
        onUploaded();
      }
    } catch (e) {
      setError(errorMessage(e, "upload failed"));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="upload-panel">
      <label className="upload-btn">
        {busy ? "Uploading…" : "Upload files"}
        <input
          type="file"
          multiple
          accept="image/*,text/*,.txt,.md"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          hidden
        />
      </label>
      <span className="hint">Images or text files</span>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
