/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import { Body, Controller, Get, Patch, Post, Req, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // Import JwtAuthGuard
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from '@prisma/client';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/common/multer.config';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Roles(Role.SUPER_ADMIN)
    @Post('create')
    create(@Request() req, @Body() dto: any) {
        console.log(req.user)
        return this.userService.createMember(req.user.memberId, dto);
    }
    @UseGuards(JwtAuthGuard)
    @Post('add-personal-info')
    @UseInterceptors(AnyFilesInterceptor(multerConfig))
    addPersonalInfo(@Request() req, @Body() dto: any, @UploadedFiles()
    files: {
        ProfileImage?: Express.Multer.File[];
        nidImageFrontPart?: Express.Multer.File[];
        nidImageBackPart?: Express.Multer.File[];
    },) {
        console.log("===as", files)
        return this.userService.addPersonalInfo(req.user.id, dto, files);
    }
    @UseGuards(JwtAuthGuard)
    @Patch('add-personal-info/update')
    updatePersonalInfo(@Request() req, @Body() dto: any) {
        return this.userService.updatePersonalInfo(req.user.id, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('add-nominee-info/update')
    updateNomineeInfo(@Request() req, @Body() dto: any) {
        return this.userService.updateNomineeInfo(req.user.id, dto);
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