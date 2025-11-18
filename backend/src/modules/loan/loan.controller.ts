import { Controller, Get, Param } from '@nestjs/common';
import { LoanService } from './loan.service';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@Controller('loan')
export class LoanController {
    constructor(private readonly service: LoanService) {}

  @Get('/:id')
  @ApiOperation({ summary: 'Get loan by ID' }) // <-- Visible in Swagger
  @ApiParam({ name: 'id', description: 'Loan ID' })
  async getLoan(@Param('id') id: string) {
    return this.service.getLoanById(id);
  }
}
