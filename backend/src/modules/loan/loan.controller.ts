import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LoanService } from './loan.service';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditService } from 'src/audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('loans')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/loans')
export class LoanController {
  constructor(
    private readonly service: LoanService,
    private readonly auditService: AuditService,
  ) {}
 @Get('/:id/audit-trail')
  @ApiOperation({ summary: 'Get loan audit trail' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  async getAuditTrail(@Param('id') id: string) {
    return this.auditService.getAuditLogsByLoanId(id);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get loan by id' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  async getLoan(@Param('id') id: string) {
    return this.service.getLoanById(id);
  }

 
}
