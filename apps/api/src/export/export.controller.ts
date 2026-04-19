import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';

@Controller('export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get()
  async exportExcel(
    @Query('brand_id') brand_id?: string,
    @Query('include_no_sell_price') include_no_sell_price?: string,
    @Res() res?: Response,
  ) {
    const filters = {
      brand_id: brand_id ? parseInt(brand_id, 10) : undefined,
      include_no_sell_price: include_no_sell_price !== 'false',
    };

    const buffer = await this.exportService.generateExcel(filters);

    const date = new Date().toISOString().split('T')[0];
    res!.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="daftar_harga_${date}.xlsx"`,
    });
    res!.send(buffer);
  }
}
