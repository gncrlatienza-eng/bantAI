import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddDomainsDto } from './dto/add-domains.dto';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { CampaignsService } from './campaigns.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // Mobile / dashboard: list active campaign clusters
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.campaignsService.findAll();
  }

  // Mobile / dashboard: get one cluster with its recent messages
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  // Internal: AI/ML service registers a new cluster after HDBSCAN run
  @Post()
  create(@Body() dto: CreateClusterDto) {
    return this.campaignsService.create(dto);
  }

  // Internal: AI/ML service appends newly discovered URL domains to a cluster
  @Patch(':id/domains')
  addDomains(@Param('id') id: string, @Body() dto: AddDomainsDto) {
    return this.campaignsService.addDomains(id, dto.domains);
  }

  // Mobile / dashboard: deactivate a campaign cluster
  @UseGuards(JwtAuthGuard)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.campaignsService.deactivate(id);
  }
}
