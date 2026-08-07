import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { IdentityService } from './identity.service';

@ApiTags('identity')
@ApiBearerAuth()
@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('users')
  @RequirePermission('identity.user.read')
  @ApiOperation({ summary: 'Daftar user (FR-M0-007)' })
  listUsers(@Query() query: { page?: number; pageSize?: number; search?: string }) {
    return this.identity.listUsers(query);
  }

  @Get('users/:id')
  @RequirePermission('identity.user.read')
  @ApiOperation({ summary: 'Detail user + grup (FR-M0-009)' })
  getUser(@Param('id') id: string) {
    return this.identity.getUser(id);
  }

  @Get('groups')
  @RequirePermission('identity.group.read')
  @ApiOperation({ summary: 'Daftar grup (FR-M0-005)' })
  listGroups() {
    return this.identity.listGroups();
  }

  @Post('users/:userId/groups/:groupId')
  @RequirePermission('identity.user.write')
  @ApiOperation({ summary: 'Masukkan user ke grup (FR-M0-021)' })
  assignGroup(
    @Param('userId') userId: string,
    @Param('groupId') groupId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.identity.assignGroup(userId, groupId, user.userId);
  }

  @Delete('users/:userId/groups/:groupId')
  @RequirePermission('identity.user.write')
  @ApiOperation({ summary: 'Keluarkan user dari grup' })
  removeGroup(@Param('userId') userId: string, @Param('groupId') groupId: string) {
    return this.identity.removeGroup(userId, groupId);
  }
}