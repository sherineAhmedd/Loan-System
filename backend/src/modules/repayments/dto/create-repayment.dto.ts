import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsDate,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRepaymentDto {
  @IsUUID()
  @IsNotEmpty()
  loanId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  paymentDate?: Date;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  principalPaid?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  interestPaid?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  lateFeePaid?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  daysLate?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

