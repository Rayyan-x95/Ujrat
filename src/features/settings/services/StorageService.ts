import { supabase } from '@/shared/lib/supabaseClient';
import type { Result } from '@/shared/types';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  avatars: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  branding: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  contracts: ['application/pdf', 'text/plain'],
  proposals: ['application/pdf', 'text/plain'],
  invoices: ['application/pdf', 'image/jpeg', 'image/png'],
  deliverables: [
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'text/plain',
    'video/mp4',
    'audio/mpeg',
  ],
};

export class StorageService {
  static validateFile(
    bucket: 'avatars' | 'contracts' | 'proposals' | 'invoices' | 'deliverables' | 'branding',
    file: File
  ): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { valid: false, error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB)` };
    }

    const allowed = ALLOWED_MIME_TYPES[bucket];
    if (allowed && file.type && !allowed.includes(file.type)) {
      return { valid: false, error: `File type '${file.type}' is not allowed for '${bucket}'. Allowed types: ${allowed.join(', ')}` };
    }

    return { valid: true };
  }

  static async uploadFile(
    workspaceId: string,
    bucket: 'avatars' | 'contracts' | 'proposals' | 'invoices' | 'deliverables' | 'branding',
    filePath: string,
    file: File
  ): Promise<Result<{ path: string; downloadUrl: string }>> {
    try {
      const validation = this.validateFile(bucket, file);
      if (!validation.valid) {
        return { success: false, error: new Error(validation.error) };
      }

      // Structure the path securely by prepending workspace ID to restrict unauthorized crossover access
      const securePath = `${workspaceId}/${filePath}`;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(securePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) return { success: false, error: new Error(error.message) };

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(securePath, 60 * 60);

      if (signedUrlError) return { success: false, error: new Error(signedUrlError.message) };

      // Track file uploads in metadata database table
      await supabase.from('file_uploads').insert({
        workspace_id: workspaceId,
        name: file.name,
        storage_path: securePath,
        bucket,
        size: file.size,
        mime_type: file.type,
      });

      return {
        success: true,
        data: {
          path: data.path,
          downloadUrl: signedUrlData.signedUrl,
        },
      };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}

