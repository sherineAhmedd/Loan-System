import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateRepaymentDto } from './dto/create-repayment.dto';

@ApiTags('repayments')
@Controller('api/repayments')
export class RepaymentsController {
  constructor(private readonly service: RepaymentsService) {}

  @Post()
  recordRepayment(@Body() payload: CreateRepaymentDto) {
    return this.service.recordRepayment(payload);
  }

  @Get(':loanId')
  @ApiParam({ name: 'loanId', description: 'Loan identifier' })
  getPaymentHistory(@Param('loanId') loanId: string) {
    return this.service.getPaymentHistory(loanId);
  }

  @Get(':loanId/schedule')
  @ApiParam({ name: 'loanId', description: 'Loan identifier' })
  getSchedule(@Param('loanId') loanId: string) {
    return this.service.getRepaymentSchedule(loanId);
  }

  @Get(':loanId/calculate')
  @ApiParam({ name: 'loanId', description: 'Loan identifier' })
  calculateDue(@Param('loanId') loanId: string) {
    return this.service.calculateDueNow(loanId);
  }
}

