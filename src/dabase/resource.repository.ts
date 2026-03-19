import { supabase } from './supabaseClient';
import { env } from '../config/env';

export interface Resource {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  status: 'uploaded' | 'processing' | 'ready' | 'error';
  public_url: string;
  created_at: string;
  updated_at: string;
}

export interface CreateResourceDto {
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  public_url: string;
}

/**
 * Repository for resource/document database operations
 */
export class ResourceRepository {
  private readonly bucket = env.storageBucket;

  /**
   * Create a new resource record
   */
  async create(data: CreateResourceDto): Promise<Resource> {
    const result = await supabase
      .from('resources')
      .insert({
        ...data,
        status: 'uploaded',
      })
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to create resource: ${result.error.message}`);
    }

    return result.data as Resource;
  }

  /**
   * Get all resources for a user
   */
  async findByUserId(userId: string): Promise<Resource[]> {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch resources: ${error.message}`);
    }

    return (data as Resource[]) ?? [];
  }

  /**
   * Get a single resource by ID
   */
  async findById(id: string): Promise<Resource | null> {
    const result = await supabase
      .from('resources')
      .select('*')
      .eq('id', id)
      .single();

    if (result.error) {
      if (result.error.code === 'PGRST116') return null;
      throw new Error(`Failed to fetch resource: ${result.error.message}`);
    }

    return result.data as Resource;
  }

  /**
   * Update resource status
   */
  async updateStatus(
    id: string,
    status: Resource['status'],
  ): Promise<Resource> {
    const result = await supabase
      .from('resources')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      throw new Error(`Failed to update resource: ${result.error.message}`);
    }

    return result.data as Resource;
  }

  /**
   * Delete a resource by ID
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('resources').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete resource: ${error.message}`);
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ path: string; publicUrl: string }> {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/${timestamp}_${sanitizedName}`;

    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(this.bucket).getPublicUrl(filePath);

    return { path: filePath, publicUrl };
  }

  /**
   * Delete file from Supabase Storage
   */
  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get signed URL for private file download
   */
  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * List files from storage (fallback if no DB table)
   */
  async listStorageFiles(userId: string): Promise<
    {
      name: string;
      id: string | null;
      created_at: string | null;
      metadata: any;
    }[]
  > {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .list(userId, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (
      data?.filter((file) => file.name !== '.emptyFolderPlaceholder') ?? []
    );
  }
}

export const resourceRepository = new ResourceRepository();
