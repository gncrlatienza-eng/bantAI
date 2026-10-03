import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { StaffGuard } from '../auth/guards/staff.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AuthAudience } from '../auth/constants';
import { PortalLicensed } from '../access-control/portal-route.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddDomainsDto } from './dto/add-domains.dto';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { UpdateCampaignIntelligenceDto } from './dto/update-campaign-intelligence.dto';
import { ApproveMaskedMessageDto } from './dto/approve-masked-message.dto';
import { CreateAdminCampaignDto } from './dto/create-admin-campaign.dto';
import { SetCampaignIndicatorsDto } from './dto/set-campaign-indicators.dto';
import { WebCampaignAudienceGuard } from './guards/web-campaign-audience.guard';
import { CampaignsService } from './campaigns.service';
import { CampaignReconciliationService } from './campaign-reconciliation.service';
import { CampaignAnalysisService } from './campaign-analysis.service';
import { EmergingWavesService } from './emerging-waves.service';
import {
  CorrectAssignmentDto,
  DraftEvolutionDto,
  MergeCampaignsDto,
  SplitCampaignDto,
} from './dto/reconcile-campaign.dto';

@Controller('campaigns')
@RequirePermissions('campaigns:manage')
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly reconciliation: CampaignReconciliationService,
    private readonly analysis: CampaignAnalysisService,
    private readonly emergingWaves: EmergingWavesService,
  ) {}

  // Recomputes the latest completed 7-day window for every live campaign and
  // files any findings as DRAFT evolution events awaiting approval.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/analysis/run')
  runAnalysis(@Request() req: { user: { userId: string } }) {
    return this.analysis.run({ actorUserId: req.user.userId });
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/:id/analysis')
  runCampaignAnalysis(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.analysis.run({ actorUserId: req.user.userId, campaignId: id });
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('admin/:id/observations')
  observations(@Param('id', ParseUUIDPipe) id: string) {
    return this.analysis.listObservations(id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/:targetId/merge')
  merge(
    @Request() req: { user: { userId: string } },
    @Param('targetId') targetId: string,
    @Body() dto: MergeCampaignsDto,
  ) {
    return this.reconciliation.merge(targetId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/:sourceId/split')
  split(
    @Request() req: { user: { userId: string } },
    @Param('sourceId') sourceId: string,
    @Body() dto: SplitCampaignDto,
  ) {
    return this.reconciliation.split(sourceId, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/assignments/correct')
  correctAssignment(
    @Request() req: { user: { userId: string } },
    @Body() dto: CorrectAssignmentDto,
  ) {
    return this.reconciliation.correctAssignment(dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/:id/evolution')
  draftEvolution(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: DraftEvolutionDto,
  ) {
    return this.reconciliation.draftEvolution(id, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('admin/:id/evolution')
  listEvolution(@Param('id') id: string) {
    return this.reconciliation.listEvolution(id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('admin/:id/assignment-history')
  listAssignmentHistory(@Param('id') id: string) {
    return this.reconciliation.listAssignmentHistory(id);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/evolution/:eventId/approve')
  approveEvolution(
    @Request() req: { user: { userId: string } },
    @Param('eventId') eventId: string,
  ) {
    return this.reconciliation.approveEvolution(eventId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin')
  createAdmin(
    @Request() req: { user: { userId: string } },
    @Body() dto: CreateAdminCampaignDto,
  ) {
    return this.campaignsService.createAdmin(dto, req.user.userId);
  }

  // Archives retired clusters no message ever linked to (leftovers from
  // offline-clustering syncs). Never deletes; safe to run repeatedly.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/archive-empty')
  @HttpCode(HttpStatus.OK)
  archiveEmpty(@Request() req: { user: { userId: string } }) {
    return this.campaignsService.archiveEmpty(req.user.userId);
  }

  // Groups scam texts no known campaign matched into new campaigns now,
  // instead of waiting for the next ingest or the 30-minute run.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post('admin/emerging/run')
  @HttpCode(HttpStatus.OK)
  runEmerging(@Request() req: { user: { userId: string } }) {
    return this.emergingWaves.run(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Get('admin/archived')
  findArchived() {
    return this.campaignsService.findArchived();
  }

  // Mobile / dashboard: list active campaign clusters
  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'CAMPAIGN_INTELLIGENCE',
  })
  @Get()
  findAll(@Request() req: { user: { audience: AuthAudience } }) {
    return req.user.audience === AuthAudience.CLIENT
      ? this.campaignsService.findShieldAll()
      : this.campaignsService.findAll();
  }

  // Internal: AI service fetches all active centroids for cosine-similarity matching
  @UseGuards(ApiKeyGuard)
  @Get('centroids')
  findAllCentroids() {
    return this.campaignsService.findAllCentroids();
  }

  // Mobile / dashboard: list inactive (past) campaign clusters
  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'CAMPAIGN_INTELLIGENCE',
  })
  @Get('inactive')
  async findAllInactive(@Request() req: { user: { audience: AuthAudience } }) {
    return req.user.audience === AuthAudience.CLIENT
      ? (await this.campaignsService.findShieldAll()).filter(
          (campaign) => campaign.status === 'DORMANT',
        )
      : this.campaignsService.findAllInactive();
  }

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'CAMPAIGN_INTELLIGENCE',
  })
  @Get('active')
  async findActive(@Request() req: { user: { audience: AuthAudience } }) {
    return req.user.audience === AuthAudience.CLIENT
      ? (await this.campaignsService.findShieldAll()).filter(
          (campaign) => campaign.status === 'ACTIVE',
        )
      : this.campaignsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'CAMPAIGN_INTELLIGENCE',
  })
  @Get('updates')
  findUpdates(@Request() req: { user: { audience: AuthAudience } }) {
    return req.user.audience === AuthAudience.CLIENT
      ? this.campaignsService.findShieldAll()
      : this.campaignsService.findAll();
  }

  @UseGuards(JwtAuthGuard, WebCampaignAudienceGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'CAMPAIGN_INTELLIGENCE',
  })
  @Get(':id/masked-messages')
  findMaskedMessages(@Param('id') id: string) {
    return this.campaignsService.findShieldMaskedMessages(id);
  }

  @UseGuards(JwtAuthGuard, WebCampaignAudienceGuard)
  @PortalLicensed({
    capability: 'exportData',
    entitlement: 'DATA_EXPORT',
  })
  @Header('Content-Disposition', 'attachment; filename="campaign.json"')
  @Get(':id/export')
  exportCampaign(@Param('id') id: string) {
    // The export path deliberately reuses the exact Shield serializer.
    return this.campaignsService.findShieldOne(id);
  }

  // Mobile / dashboard: get one cluster with its recent messages
  @UseGuards(JwtAuthGuard)
  @PortalLicensed({
    capability: 'readIntelligence',
    entitlement: 'CAMPAIGN_INTELLIGENCE',
  })
  @Get(':id')
  findOne(
    @Request() req: { user: { userId: string; audience: AuthAudience } },
    @Param('id') id: string,
  ) {
    if (req.user.audience === AuthAudience.CLIENT) {
      return this.campaignsService.findShieldOne(id);
    }
    if (req.user.audience === AuthAudience.ADMIN) {
      return this.campaignsService.findAdminOne(id, req.user.userId);
    }
    return this.campaignsService.findOne(id, req.user.userId);
  }

  // Internal: AI/ML service registers a new cluster after HDBSCAN run
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateClusterDto) {
    return this.campaignsService.create(dto);
  }

  // Internal: AI/ML service appends newly discovered URL domains to a cluster
  @UseGuards(ApiKeyGuard)
  @Patch(':id/domains')
  addDomains(@Param('id') id: string, @Body() dto: AddDomainsDto) {
    return this.campaignsService.addDomains(id, dto.domains);
  }

  // Human administrative operation. Machine credentials cannot act as a user.
  @UseGuards(JwtAuthGuard, StaffGuard)
  @Put(':id/indicators')
  setIndicators(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SetCampaignIndicatorsDto,
  ) {
    return this.campaignsService.setIndicators(id, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id/archive')
  archive(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.archive(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id/reactivate')
  reactivate(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.reactivate(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id/intelligence')
  updateIntelligence(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCampaignIntelligenceDto,
  ) {
    return this.campaignsService.updateIntelligence(id, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post(':id/publish')
  publish(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.campaignsService.publish(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Post(':id/masked-messages/approve')
  approveMaskedMessage(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: ApproveMaskedMessageDto,
  ) {
    return this.campaignsService.approveMaskedMessage(id, dto, req.user.userId);
  }

  @UseGuards(JwtAuthGuard, StaffGuard)
  @Patch(':id/deactivate')
  deactivate(
    @Param('id') id: string,
    @Request() req: { user: { userId: string } },
  ) {
    return this.campaignsService.deactivate(id, req.user.userId);
  }

  @UseGuards(ApiKeyGuard)
  @Patch('internal/:id/deactivate')
  deactivateInternal(@Param('id') id: string) {
    return this.campaignsService.deactivate(id);
  }
}
