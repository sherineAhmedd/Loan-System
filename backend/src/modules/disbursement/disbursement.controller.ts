import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DisbursementService } from './disbursement.service';
import { CreateDisbursementDto } from './dto/create-disbursement.dto';
import { RollbackDisbursementDto } from './dto/rollback-disbursement.dto';

@ApiTags('disbursements')
@Controller('api/disbursements')
export class DisbursementController {
  constructor(private readonly disbursementService: DisbursementService) {}

  @Post()
  @ApiOperation({})
  create(@Body() dto: CreateDisbursementDto) {
    return this.disbursementService.createDisbursement(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  findOne(@Param('id') id: string) {
    return this.disbursementService.getDisbursement(id);
  }

  @Post(':id/rollback')
  @ApiParam({ name: 'id', required: true })
  rollback(
    @Param('id') id: string,
    @Body() payload: RollbackDisbursementDto,
  ) {
    return this.disbursementService.rollbackDisbursement(id, payload);
  }
}
