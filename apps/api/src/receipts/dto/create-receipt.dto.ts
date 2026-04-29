import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReceiptDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customer_name?: string | null;
}
