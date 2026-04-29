import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ReceiptStatus } from '@prisma/client';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { ReplaceItemsDto } from './dto/replace-items.dto';

@Controller('receipts')
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const safeStatus =
      status === 'DRAFT' || status === 'FINALIZED'
        ? (status as ReceiptStatus)
        : undefined;
    return this.receiptsService.list({
      status: safeStatus,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('latest-draft')
  async latestDraft() {
    const receipt = await this.receiptsService.latestDraft();
    return { receipt };
  }

  @Get('trash')
  trash(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const safeStatus =
      status === 'DRAFT' || status === 'FINALIZED'
        ? (status as ReceiptStatus)
        : undefined;
    return this.receiptsService.list({
      status: safeStatus,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      deleted: true,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReceiptDto) {
    return this.receiptsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.receiptsService.update(id, dto);
  }

  @Put(':id/items')
  replaceItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceItemsDto,
  ) {
    return this.receiptsService.replaceItems(id, dto.items);
  }

  @Delete(':id/items/:itemId')
  deleteItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.receiptsService.deleteItem(id, itemId);
  }

  @Post(':id/finalize')
  finalize(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.finalize(id);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.duplicate(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.remove(id);
  }

  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.restore(id);
  }

  @Delete(':id/permanent')
  permanentRemove(@Param('id', ParseIntPipe) id: number) {
    return this.receiptsService.permanentRemove(id);
  }
}
