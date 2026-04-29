import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BulkCreateProductDto } from './dto/bulk-create-product.dto';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('brand_id') brand_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort_by') sort_by?: string,
    @Query('sort_dir') sort_dir?: string,
  ) {
    const allowedSortBy = ['name', 'brand', 'created_at'] as const;
    const allowedSortDir = ['asc', 'desc'] as const;
    const safeSortBy = allowedSortBy.includes(sort_by as any)
      ? (sort_by as (typeof allowedSortBy)[number])
      : undefined;
    const safeSortDir = allowedSortDir.includes(sort_dir as any)
      ? (sort_dir as (typeof allowedSortDir)[number])
      : undefined;

    return this.productsService.findAll({
      search,
      brand_id: brand_id ? parseInt(brand_id, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sort_by: safeSortBy,
      sort_dir: safeSortDir,
    });
  }

  @Get('trash')
  findDeleted(
    @Query('search') search?: string,
    @Query('brand_id') brand_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productsService.findAll({
      search,
      brand_id: brand_id ? parseInt(brand_id, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      deleted: true,
    });
  }

  @Get('duplicate-check')
  duplicateCheck(
    @Query('brand_id', ParseIntPipe) brand_id: number,
    @Query('name') name?: string,
  ) {
    return this.productsService.findDuplicates({ brand_id, name: name ?? '' });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkCreateProductDto) {
    return this.productsService.bulkCreate(dto.products);
  }

  @Patch('bulk')
  bulkUpdate(@Body() dto: BulkUpdateProductDto) {
    return this.productsService.bulkUpdate(dto.updates);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.restore(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  @Delete(':id/permanent')
  permanentRemove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.permanentRemove(id);
  }
}
