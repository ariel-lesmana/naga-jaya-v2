import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReceiptDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customer_name?: string | null;
}
