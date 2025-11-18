import {IsDate, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID,Min,Validate,} from 'class-validator';
import { Type } from 'class-transformer';
import { IsAfterPropertyDate } from '../validators/is-after-property-date.validator';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'EGP'];
const STATUS_VALUES = ['pending', 'completed', 'failed', 'rolled_back'] as const;

export class CreateDisbursementDto {
  @IsUUID()
  @IsNotEmpty()
  loanId: string;

  @IsUUID()
  @IsNotEmpty()
  borrowerId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @IsIn(SUPPORTED_CURRENCIES)
  currency: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  disbursementDate: Date;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  @Validate(IsAfterPropertyDate, ['disbursementDate'])
  firstPaymentDate: Date;

  @IsInt()
  @Min(1)
  tenor: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  interestRate: number;

  @IsOptional()
  @IsIn(STATUS_VALUES)
  status?: (typeof STATUS_VALUES)[number];
}