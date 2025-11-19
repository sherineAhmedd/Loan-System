import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('repayments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/repayments')
export class RepaymentsController {
  constructor(private readonly service: RepaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Record a repayment' })
  recordRepayment(@Body() payload: CreateRepaymentDto, @Request() req: any) {
    // Extract user info from JWT token (set by JwtAuthGuard)
    const user = req.user || { sub: 'system', service: 'system' };
    return this.service.recordRepayment(payload, user);
  }

  @Get(':loanId')
  @ApiParam({ name: 'loanId', description: 'Loan identifier' })
  @ApiOperation({ summary: 'Get payment history for a loan' })
  getPaymentHistory(@Param('loanId') loanId: string) {
    return this.service.getPaymentHistory(loanId);
  }

  @Get(':loanId/schedule')
  @ApiParam({ name: 'loanId', description: 'Loan identifier' })
  @ApiOperation({ summary: 'Get repayment schedule for a loan' })
  getSchedule(@Param('loanId') loanId: string) {
    return this.service.getRepaymentSchedule(loanId);
  }

  @Get(':loanId/calculate')
  @ApiParam({ name: 'loanId', description: 'Loan identifier' })
  @ApiOperation({ summary: 'Calculate due amount for a loan' })
  calculateDue(@Param('loanId') loanId: string, @Request() req: any) {
    // Extract user info from JWT token (set by JwtAuthGuard)
    const user = req.user || { sub: 'system', service: 'system' };
    return this.service.calculateDueNow(loanId, user);
  }
}

