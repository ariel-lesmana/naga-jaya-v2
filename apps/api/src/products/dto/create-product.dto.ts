import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Type(() => Number)
  brand_id: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_per_karton?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_per_kotak?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_per_pak?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_per_lusin?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_per_pcs?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_net?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_daftar?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_jual?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_jual_per_lusin?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_jual_per_karton?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_jual_per_kotak?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_jual_per_pak?: number | null;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  harga_gross?: number | null;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  disc_pct?: number | null;
}
