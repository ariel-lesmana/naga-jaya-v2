import { IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateProductDto } from './update-product.dto';

export class BulkUpdateItemDto {
  @IsInt()
  @Type(() => Number)
  id!: number;

  @ValidateNested()
  @Type(() => UpdateProductDto)
  patch!: UpdateProductDto;
}

export class BulkUpdateProductDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  updates!: BulkUpdateItemDto[];
}
