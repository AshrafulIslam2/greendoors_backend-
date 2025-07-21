
import { Body, Controller, Get, Patch, Post, Req, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';

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
}
