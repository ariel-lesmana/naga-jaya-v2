import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PriceHistoryService } from './price-history.service';

@Controller()
export class PriceHistoryController {
  constructor(private priceHistoryService: PriceHistoryService) {}

  @Get('products/:id/history')
  async getProductHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query('field') field?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.priceHistoryService.getHistory(id, {
      field,
      limit: limit ? parseInt(limit, 10) : undefined,
      before: before ? new Date(before) : undefined,
    });
  }

  @Get('history/summary')
  async getSummary(
    @Query('days') days?: string,
    @Query('brand_id') brand_id?: string,
    @Query('limit') limit?: string,
  ) {
    return this.priceHistoryService.getSummary({
      days: days ? parseInt(days, 10) : undefined,
      brand_id: brand_id ? parseInt(brand_id, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
