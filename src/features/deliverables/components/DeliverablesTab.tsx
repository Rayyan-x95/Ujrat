import React, { useState } from 'react';
import { Card } from '@/shared/ui/Card';
import { FileUploadZone } from '@/shared/ui/Containers';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Input } from '@/shared/ui/Input';
import { Lock, FileUp, FolderOpen, Link, ArrowUpRight } from 'lucide-react';
import type { Deliverable } from '@/shared/types';

interface DeliverablesTabProps {
  deliverables: Deliverable[];
  projectStatus: string;
  onUpload: (file: File) => Promise<void>;
  onAddLink?: (name: string, linkUrl: string) => Promise<void>;
  onActivateWork: () => void;
}

export const DeliverablesTab: React.FC<DeliverablesTabProps> = ({
  deliverables,
  projectStatus,
  onUpload,
  onAddLink,
  onActivateWork,
}) => {
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkName.trim() || !linkUrl.trim() || !onAddLink) return;
    try {
      setAddingLink(true);
      await onAddLink(linkName.trim(), linkUrl.trim());
      setLinkName('');
      setLinkUrl('');
    } finally {
      setAddingLink(false);
    }
  };

  const isLocked = projectStatus === 'lead' || projectStatus === 'proposal' || projectStatus === 'approved' || projectStatus === 'contract_signed';

  return (
    <div className="space-y-6.5 animate-slide-up">
      {isLocked ? (
        <Card className="p-8 text-center border-dashed border-border space-y-4 flex flex-col items-center justify-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="h-12 w-12 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground mx-auto shadow-sm">
              <Lock className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <h3 className="text-small font-bold text-foreground m-0">Deliverables Workspace Locked</h3>
            <p className="text-xs text-muted-foreground m-0 leading-normal">
              Uploading project deliverables and final file downloads becomes accessible once the project service agreement has been authorized and project execution is active.
            </p>
            {projectStatus === 'contract_signed' && (
              <div className="pt-2">
                <Button variant="primary" size="sm" onClick={onActivateWork}>
                  Activate Project Work
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-5.5 space-y-5">
          <div className="border-b border-border-subtle pb-3.5 flex justify-between items-start flex-wrap gap-4">
            <div>
              <h3 className="text-small font-bold text-foreground m-0 flex items-center gap-2">
                <FileUp className="h-4.5 w-4.5 text-primary" />
                <span>Project Deliverables Workspace</span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 m-0">Upload final assets directly or attach cloud URLs (Google Drive, Dropbox, Figma) for client review.</p>
            </div>
            <div className="flex bg-surface/50 p-1 border border-border rounded-lg select-none">
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  uploadMode === 'file'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('link')}
                className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  uploadMode === 'link'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cloud Link
              </button>
            </div>
          </div>

          {uploadMode === 'file' ? (
            <FileUploadZone 
              onFile={handleUpload} 
              label={uploading ? "Uploading deliverable file..." : "Drag & drop files to upload securely"} 
            />
          ) : (
            <form onSubmit={handleLinkSubmit} className="space-y-4 bg-surface/10 p-4 border border-border rounded-lg animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Deliverable Name / Title"
                  placeholder="e.g., Google Drive Folder, Figma Board, Prototype Link"
                  value={linkName}
                  onChange={e => setLinkName(e.target.value)}
                  required
                />
                <Input
                  label="Cloud URL"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" size="sm" loading={addingLink}>
                  Add Link Deliverable
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-foreground m-0 flex items-center gap-1.5 select-none">
              <FolderOpen className="h-4 w-4 text-muted-foreground/50" />
              <span>Shared Deliverables ({deliverables.length})</span>
            </h4>
            
            {deliverables.length === 0 ? (
              <p className="text-xs text-muted-foreground italic m-0 bg-surface/30 p-4 border border-dashed rounded text-center">No files or cloud links attached yet.</p>
            ) : (
              <div className="border border-border rounded-lg bg-card divide-y divide-border-subtle overflow-hidden shadow-sm">
                {deliverables.map((f: Deliverable) => (
                                  <div key={f.id} className="p-3 flex justify-between items-center text-xs hover:bg-surface/30 transition-colors">
                                    <div className="min-w-0 pr-2">
                                      <p className="font-semibold text-foreground truncate m-0 flex items-center gap-1.5">
                                        {f.file_type === 'link' && <Link className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />}
                                        <span>{f.name}</span>
                                      </p>
                                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">
                                        {f.file_type === 'link'
                                          ? 'External Cloud Resource'
                                          : `${((f.file_size || 0) / 1024 / 1024).toFixed(2)} MB • ${f.file_type}`}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                      {f.file_type === 'link' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-[10px] py-1 px-2 border border-border"
                                          onClick={() => window.open(f.file_url, '_blank', 'noopener,noreferrer')}
                                          icon={<ArrowUpRight className="h-3 w-3" />}
                                        >
                                          Open Link
                                        </Button>
                                      )}
                                      <Badge variant="primary" size="sm">shared</Badge>
                                    </div>
                                  </div>
                                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
