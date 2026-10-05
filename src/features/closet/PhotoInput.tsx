import { useRef, useState } from 'react';
import { resizeImage } from '../../lib/image';
import { useObjectUrl } from '../../lib/hooks';
import { Button, Icon } from '../../components/ui';

/** Photo picker supporting file upload and (on mobile) direct camera capture. */
export function PhotoInput({ value, onChange }: { value?: Blob; onChange: (b?: Blob) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const url = useObjectUrl(value);

  async function handle(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      onChange(await resizeImage(file));
    } catch {
      setError('Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
        {url ? <img src={url} alt="Item preview" className="h-full w-full object-cover" /> : <Icon name="camera" className="h-6 w-6" />}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Processing…' : 'Upload photo'}
          </Button>
          <Button onClick={() => camRef.current?.click()} disabled={busy}>
            <Icon name="camera" /> Camera
          </Button>
          {value && (
            <Button variant="ghost" onClick={() => onChange(undefined)}>
              Remove
            </Button>
          )}
        </div>
        {error && <span className="text-xs text-red-700">{error}</span>}
        <span className="text-xs text-slate-500">Resized to 800px and stored only on this device.</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handle(e.target.files)} data-testid="photo-file" />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handle(e.target.files)} />
    </div>
  );
}
