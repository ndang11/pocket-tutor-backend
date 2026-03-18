import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  async uploadAndRecord(
    file: Express.Multer.File,
    userId: string,
    title: string,
  ) {
    if (!file?.originalname) throw new BadRequestException('Invalid file');
    if (!userId?.trim() || !title?.trim())
      throw new BadRequestException('userId and title are required');

    const fileExt = file.originalname.split('.').pop();
    if (!fileExt || fileExt === file.originalname)
      throw new BadRequestException('Could not determine file extension');

    const storagePath = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await this.supabase
      .getClient()
      .storage.from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) throw new BadRequestException(`Storage Error: ${error.message}`);

    return this.prisma.documentation.create({
      data: { title, path: data.path, userId },
    });
  }
}
