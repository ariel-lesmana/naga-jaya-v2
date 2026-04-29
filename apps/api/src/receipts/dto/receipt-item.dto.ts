import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptUnit } from '@prisma/client';

export class ReceiptItemDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  id?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  product_id?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  quantity?: number | null;

  @IsOptional()
  @IsEnum(ReceiptUnit)
  unit_type?: ReceiptUnit | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  discount_per_unit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  line_total_override?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  position?: number;
}
