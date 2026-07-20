import { supabase } from '@/shared/lib/supabaseClient';
import type { Result } from '@/shared/types';

export class StorageService {
  static async uploadFile(
    workspaceId: string,
    bucket: 'avatars' | 'contracts' | 'proposals' | 'invoices' | 'deliverables' | 'branding',
    filePath: string,
    file: File
  ): Promise<Result<{ path: string; downloadUrl: string }>> {
    try {
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

  /**
   * Get a signed download URL using the regular client (for authenticated users)
   */
  static async getSignedDownloadUrl(
    bucket: 'avatars' | 'contracts' | 'proposals' | 'invoices' | 'deliverables' | 'branding',
    filePath: string
  ): Promise<Result<string>> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60);

      if (error) return { success: false, error: new Error(error.message) };

      return { success: true, data: data.signedUrl };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}
