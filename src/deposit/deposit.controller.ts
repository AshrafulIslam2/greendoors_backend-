
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // Import JwtAuthGuard
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from '@prisma/client';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/common/multer.config';
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


    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Get('/:id')
    depositById(@Request() req, @Query() paginationDto) {
        const user = req.user
        const { page, limit } = paginationDto;
        return this.depositService.getDepositById(user.memberId, page, limit,);
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
