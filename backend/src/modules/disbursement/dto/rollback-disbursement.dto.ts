import { IsOptional, IsString } from 'class-validator';

export class RollbackDisbursementDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;
}

