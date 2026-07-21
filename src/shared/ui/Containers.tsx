import React, { useRef, useState } from 'react';
import { Spinner } from './Feedback';

interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const avatarSizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-small',
  lg: 'h-11 w-11 text-body',
  xl: 'h-14 w-14 text-title',
};

const initials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  return parts.length === 1 ? first[0] || '?' : (first[0] || '?') + (last[0] || '');
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md' }) => (
  <div className={`relative inline-flex shrink-0 ${avatarSizes[size]} rounded-full overflow-hidden bg-secondary font-medium text-foreground uppercase items-center justify-center ring-1 ring-inset ring-border-subtle`}>
    {src ? (
      <img src={src} alt={name ?? 'avatar'} className="h-full w-full object-cover" />
    ) : (
      <span>{initials(name)}</span>
    )}
  </div>
);

interface DropdownItem {
  label: string;
  icon?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, items, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen(v => !v)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-1 z-50 w-48 rounded-lg bg-surface-raised shadow-lg overflow-hidden py-1 animate-scale-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.divider && i > 0 && <div className="my-1 section-divider" />}
              <button
                onClick={() => { if (!item.disabled) { item.onClick(); setOpen(false); } }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-body transition-colors ${
                  item.disabled ? 'opacity-40 cursor-not-allowed' :
                  item.danger ? 'text-destructive hover:bg-destructive/8' :
                  'text-foreground hover:bg-surface'
                }`}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

interface FileUploadProps {
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  onFile?: (file: File) => void;
  loading?: boolean;
  hint?: string;
}

export const FileUploadZone: React.FC<FileUploadProps> = ({
  label = 'Upload File', accept, maxSizeMB = 10, onFile, loading = false, hint,
}) => {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError('');
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File is too large. Max ${maxSizeMB}MB allowed.`);
      return;
    }
    setFileName(file.name);
    onFile?.(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      {label && <span className="text-label block mb-1.5">{label}</span>}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg p-8 cursor-pointer transition-colors text-center ${
          drag ? 'bg-primary-muted ring-2 ring-primary/30' : 'bg-surface hover:bg-accent/50 ring-1 ring-inset ring-border-subtle'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {loading ? (
          <Spinner size="md" />
        ) : (
          <>
            <svg className="h-7 w-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {fileName ? (
              <p className="text-body font-medium text-primary m-0">{fileName}</p>
            ) : (
              <>
                <p className="text-body font-medium text-foreground m-0">Drop file or click to upload</p>
                {hint && <p className="text-small text-muted-foreground m-0">{hint}</p>}
                <p className="text-[11px] text-muted-foreground/60 m-0">Max {maxSizeMB}MB</p>
              </>
            )}
          </>
        )}
      </div>
      {error && <p className="text-[11px] text-destructive mt-1.5 m-0">{error}</p>}
    </div>
  );
};

export const PDFPreviewContainer: React.FC<{
  src?: string;
  label?: string;
  height?: number;
}> = ({ src, label, height = 500 }) => (
  <div className="space-y-2">
    {label && <span className="text-label">{label}</span>}
    {src ? (
      <iframe
        src={src}
        className="w-full rounded-lg ring-1 ring-inset ring-border-subtle bg-surface"
        style={{ height }}
        title="PDF Preview"
      />
    ) : (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg bg-surface ring-1 ring-inset ring-border-subtle"
        style={{ height }}
      >
        <svg className="h-7 w-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-small text-muted-foreground m-0">PDF preview will appear here</p>
      </div>
    )}
  </div>
);

export default Avatar;
