
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Import JwtAuthGuard
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../common/multer.config';
import { DepositService } from './deposit.service';
@Controller('deposit')
export class DepositController {
    constructor(private readonly depositService: DepositService) { }

    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Roles(Role.SUPER_ADMIN)
    @Post('')
    create(@Request() req, @Body() dto: any) {
        console.log(req.user)
        return this.depositService.addDeposit(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Roles(Role.SUPER_ADMIN)
    @Get('')
    get(@Query() paginationDto) {
        const { page, limit } = paginationDto;
        return this.depositService.getDeposit(page, limit);
    }


    // Use JwtAuthGuard instead of AuthGuard('jwt')
    @UseGuards(JwtAuthGuard)
    @Get('/me')
    userDeposits(@Request() req, @Query() paginationDto) {
        const user = req.user
        const { page, limit } = paginationDto;
        return this.depositService.getDepositById(user.memberId, page, limit);
    }
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Get('/cashbalance')
    async cashBalance() {
        return this.depositService.getCashBalance();
    }
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Get('/cashbalance/:memberId')
    async memberCashBalance(@Param('memberId') memberId: string) {
        return this.depositService.memberCashBalance(memberId);
    }
    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Get('/:id')
    depositById(@Request() req, @Query() paginationDto, @Param('id') id: string) {
        const { page, limit } = paginationDto;
        return this.depositService.getDepositById(id, page, limit,);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Patch('/:id')
    depositEditById(@Request() req, @Body() dto: any, @Param('id') id: number) {
        const user = req.user
        console.log(user)
        return this.depositService.editDeposit(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPER_ADMIN) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Delete('/:id')
    depositDeleteById(@Request() req, @Param('id') id: number) {
        const user = req.user
        console.log(user)
        return this.depositService.deleteDeposit(id);
    }







}
