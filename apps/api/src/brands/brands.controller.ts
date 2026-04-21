import { Body, Controller, Get, Post } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';

@Controller('brands')
export class BrandsController {
  constructor(private brandsService: BrandsService) {}

  @Get()
  findAll() {
    return this.brandsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }
}
