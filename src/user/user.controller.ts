/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Post, Req, Request, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // Import JwtAuthGuard
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Roles(Role.SUPER_ADMIN)
    @Post('create')
    create(@Body() dto: any) {
        return this.userService.createMember(dto);
    }
    @UseGuards(JwtAuthGuard)
    @Post('add-personal-info')
    addPersonalInfo(@Request() req, @Body() dto: any) {
        return this.userService.addPersonalInfo(req.user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('add-nominee-info')
    addNomineeInfo(@Request() req, @Body() dto) {
        return this.userService.addNomineeInfo(req.user.id, dto);
    }
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMyInfo(@Req() req) {
        const userId = req.user.id;
        return this.userService.getUserInfo(userId);
    }
}