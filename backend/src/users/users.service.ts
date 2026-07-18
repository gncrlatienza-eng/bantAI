import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      },
    });
  }
}
