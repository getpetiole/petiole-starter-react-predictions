// A photo: dropped, chosen, or on a phone taken with its camera.
import { type DragEvent, useState } from "react";

const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function PhotoPicker({ disabled, onPhoto }: { disabled: boolean; onPhoto: (file: File) => void }) {
  const [over, setOver] = useState(false);

  function take(files: FileList | null) {
    const file = files?.[0];
    if (file) onPhoto(file);
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (!disabled) take(event.dataTransfer.files);
  }

  return (
    <div
      className={`drop${over ? " over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <p>Drop a photo of leaves here, or</p>
      <div className="actions">
        <label className={`button ${coarse ? "secondary" : "primary"}${disabled ? " disabled" : ""}`}>
          Choose a photo
          <input
            type="file"
            className="visually-hidden"
            accept="image/jpeg,image/png"
            disabled={disabled}
            onChange={(event) => {
              take(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {coarse ? (
          <label className={`button primary${disabled ? " disabled" : ""}`}>
            Take a photo
            <input
              type="file"
              className="visually-hidden"
              accept="image/*"
              capture="environment"
              disabled={disabled}
              onChange={(event) => {
                take(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="hint">
        A JPEG or PNG. A photo too large to send is made smaller here, in your browser, at its own size and a lower
        quality.
      </p>
    </div>
  );
}
