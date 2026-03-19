import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  resourceRepository,
  Resource,
  CreateResourceDto,
} from '../../dabase/resource.repository';
import { env } from '../../config/env';

export interface UploadedDocument {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  mimeType: string;
  publicUrl: string;
  status: string;
  createdAt: string;
}

export interface DocumentListResponse {
  documents: UploadedDocument[];
  total: number;
}

@Injectable()
export class ResourcesService {
  private readonly bucket = env.storageBucket;

  /**
   * Get file type from filename
   */
  private getFileType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      pdf: 'PDF Document',
      doc: 'Word Document',
      docx: 'Word Document',
      txt: 'Text File',
      png: 'Image',
      jpg: 'Image',
      jpeg: 'Image',
      gif: 'Image',
      mp3: 'Audio',
      wav: 'Audio',
      mp4: 'Video',
    };
    return typeMap[extension] || 'File';
  }

  /**
   * Format file size to human readable
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Upload a document for a user
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UploadedDocument> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds 50MB limit');
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not supported`,
      );
    }

    try {
      // Upload to storage
      const { path, publicUrl } = await resourceRepository.uploadFile(
        userId,
        file,
      );

      // Create resource record in database
      const resourceData: CreateResourceDto = {
        user_id: userId,
        file_name: file.originalname,
        file_path: path,
        file_type: this.getFileType(file.originalname),
        file_size: file.size,
        mime_type: file.mimetype,
        public_url: publicUrl,
      };

      const resource = await resourceRepository.create(resourceData);

      return this.mapToDocument(resource);
    } catch (error) {
      throw new BadRequestException(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get all documents for a user
   */
  async getUserDocuments(userId: string): Promise<DocumentListResponse> {
    try {
      // Try to get from database first
      const resources = await resourceRepository.findByUserId(userId);

      if (resources.length > 0) {
        return {
          documents: resources.map((r) => this.mapToDocument(r)),
          total: resources.length,
        };
      }

      // Fallback to storage listing if no DB records
      const storageFiles = await resourceRepository.listStorageFiles(userId);

      const documents: UploadedDocument[] = storageFiles.map((file) => {
        const metadata = file.metadata as
          | { size?: number; mimetype?: string }
          | undefined;
        return {
          id: file.id || file.name,
          name: file.name,
          path: `${userId}/${file.name}`,
          size: metadata?.size || 0,
          type: this.getFileType(file.name),
          mimeType: metadata?.mimetype || 'application/octet-stream',
          publicUrl: '',
          status: 'uploaded',
          createdAt: file.created_at || new Date().toISOString(),
        };
      });

      return {
        documents,
        total: documents.length,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get a single document by ID
   */
  async getDocument(
    userId: string,
    documentId: string,
  ): Promise<UploadedDocument> {
    const resource = await resourceRepository.findById(documentId);

    if (!resource) {
      throw new NotFoundException('Document not found');
    }

    if (resource.user_id !== userId) {
      throw new NotFoundException('Document not found');
    }

    return this.mapToDocument(resource);
  }

  /**
   * Delete a document
   */
  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const resource = await resourceRepository.findById(documentId);

    if (!resource) {
      throw new NotFoundException('Document not found');
    }

    if (resource.user_id !== userId) {
      throw new NotFoundException('Document not found');
    }

    try {
      // Delete from storage
      await resourceRepository.deleteFile(resource.file_path);

      // Delete from database
      await resourceRepository.delete(documentId);
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Delete a document by file path (for storage-only deletion)
   */
  async deleteDocumentByPath(userId: string, filePath: string): Promise<void> {
    // Verify the path belongs to the user
    if (!filePath.startsWith(userId)) {
      throw new NotFoundException('Document not found');
    }

    try {
      await resourceRepository.deleteFile(filePath);
    } catch (error) {
      throw new BadRequestException(
        `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get download URL for a document
   */
  async getDownloadUrl(userId: string, documentId: string): Promise<string> {
    const resource = await resourceRepository.findById(documentId);

    if (!resource) {
      throw new NotFoundException('Document not found');
    }

    if (resource.user_id !== userId) {
      throw new NotFoundException('Document not found');
    }

    return resourceRepository.getSignedUrl(resource.file_path);
  }

  /**
   * Map Resource to UploadedDocument response
   */
  private mapToDocument(resource: Resource): UploadedDocument {
    return {
      id: resource.id,
      name: resource.file_name,
      path: resource.file_path,
      size: resource.file_size,
      type: resource.file_type,
      mimeType: resource.mime_type,
      publicUrl: resource.public_url,
      status: resource.status,
      createdAt: resource.created_at,
    };
  }
}
