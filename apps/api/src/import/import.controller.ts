import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ImportService, ParsedRow, ImportOptions } from './import.service';
import { ExportService } from '../export/export.service';

@Controller('import')
export class ImportController {
  constructor(
    private importService: ImportService,
    private exportService: ExportService,
  ) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (
          allowed.includes(file.mimetype) ||
          file.originalname.match(/\.(xlsx|xls)$/i)
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Format file harus .xlsx atau .xls'), false);
        }
      },
    }),
  )
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File tidak ditemukan');
    }

    const rows = this.importService.parseExcelBuffer(file.buffer);
    const diff = await this.importService.diffWithDatabase(rows);
    return { rows, diff };
  }

  @Post('commit')
  async commit(
    @Body() body: { rows: ParsedRow[]; options: ImportOptions },
  ) {
    if (!body.rows || !body.options) {
      throw new BadRequestException('rows dan options wajib diisi');
    }
    return this.importService.commitImport(body.rows, body.options);
  }

  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.exportService.generateTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template_import.xlsx"',
    });
    res.send(buffer);
  }
}
