import { Controller, Get, Param, Query } from '@nestjs/common';
import { LoanService } from './loan.service';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuditService } from 'src/audit/audit.service';

@Controller('api/loans')
export class LoanController {
  constructor(
    private readonly service: LoanService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List loans' })
  @ApiQuery({ name: 'q', required: false, description: 'Search by loan or borrower id' })
  @ApiQuery({ name: 'borrowerId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'perPage', required: false, type: Number })
  async listLoans(
    @Query('q') q?: string,
    @Query('borrowerId') borrowerId?: string,
    @Query('page') page?: number,
    @Query('perPage') perPage?: number,
  ) {
    const pageNumber = page !== undefined ? Number(page) : undefined;
    const perPageNumber = perPage !== undefined ? Number(perPage) : undefined;
    return this.service.listLoans({
      q,
      borrowerId,
      page: pageNumber,
      perPage: perPageNumber,
    });
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get loan by id' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  async getLoan(@Param('id') id: string) {
    return this.service.getLoanById(id);
  }

  @Get('/:id/audit-trail')
  @ApiOperation({ summary: 'Get loan audit trail' })
  @ApiParam({ name: 'id', description: 'Loan ID' })
  async getAuditTrail(@Param('id') id: string) {
    return this.auditService.getAuditLogsByLoanId(id);
  }
}
