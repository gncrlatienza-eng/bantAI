import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { StaffGuard } from '../auth/guards/staff.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CreateModelVersionDto } from './dto/create-model-version.dto';
import { ReviewModelDto } from './dto/review-model.dto';
import { ModelsService } from './models.service';

type AuthRequest = { user: { userId: string } };

@Controller('models')
@UseGuards(JwtAuthGuard, StaffGuard)
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @RequirePermissions('models:read')
  @Get()
  findAll() {
    return this.modelsService.findAll();
  }

  @RequirePermissions('models:read')
  @Get('active')
  async findActive() {
    const model = await this.modelsService.findActive();
    if (!model) throw new NotFoundException('No active model version');
    return model;
  }

  @RequirePermissions('models:read')
  @Get('serving')
  getServingStatus() {
    return this.modelsService.getServingStatus();
  }

  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.CREATED)
  @Post()
  register(@Body() dto: CreateModelVersionDto) {
    return this.modelsService.register(dto);
  }

  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewModelDto,
    @Request() req: AuthRequest,
  ) {
    return this.modelsService.approve(id, dto.note, req.user.userId);
  }

  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewModelDto,
    @Request() req: AuthRequest,
  ) {
    return this.modelsService.reject(id, dto.note, req.user.userId);
  }

  // Records the deployment request. The AI service still has to be switched
  // to this version by an operator; see confirm-deployment.
  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/deploy')
  requestDeployment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewModelDto,
    @Request() req: AuthRequest,
  ) {
    return this.modelsService.requestActivation(id, dto.note, req.user.userId);
  }

  // Succeeds only when the AI service /health reports this version serving.
  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/confirm-deployment')
  confirmDeployment(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: AuthRequest,
  ) {
    return this.modelsService.confirmActivation(id, req.user.userId);
  }

  @RequirePermissions('models:deploy')
  @HttpCode(HttpStatus.OK)
  @Post(':id/deployment-failed')
  deploymentFailed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewModelDto,
    @Request() req: AuthRequest,
  ) {
    return this.modelsService.markActivationFailed(
      id,
      dto.note,
      req.user.userId,
    );
  }
}
