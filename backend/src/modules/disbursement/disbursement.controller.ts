import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DisbursementService } from './disbursement.service';
import { CreateDisbursementDto } from './dto/create-disbursement.dto';
import { RollbackDisbursementDto } from './dto/rollback-disbursement.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('disbursements')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/disbursements')
export class DisbursementController {
  constructor(private readonly disbursementService: DisbursementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new disbursement' })
  create(@Body() dto: CreateDisbursementDto) {
    return this.disbursementService.createDisbursement(dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Get disbursement by ID' })
  findOne(@Param('id') id: string) {
    return this.disbursementService.getDisbursement(id);
  }

  @Post(':id/rollback')
  @ApiParam({ name: 'id', required: true })
  @ApiOperation({ summary: 'Rollback a disbursement' })
  rollback(
    @Param('id') id: string,
    @Body() payload: RollbackDisbursementDto,
  ) {
    return this.disbursementService.rollbackDisbursement(id, payload);
  }
}
