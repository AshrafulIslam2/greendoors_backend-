
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
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
    @Get('')
    getUsers(@Query('page') page: number = 1,
        @Query('limit') limit: number = 10) {
        return this.userService.getUsers(page, limit);
    }

    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Roles(Role.SUPER_ADMIN)
    @Post('create')
    create(@Request() req, @Body() dto: any) {
        return this.userService.createMember(req.user.memberId, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('add-personal-info')
    @UseInterceptors(AnyFilesInterceptor(multerConfig))
    async addPersonalInfo(@Request() req, @Body() dto: any, @UploadedFiles()
    files: {
        ProfileImage?: Express.Multer.File[];
        nidImageFrontPart?: Express.Multer.File[];
        nidImageBackPart?: Express.Multer.File[];
    },) {

        try {
            const result = await this.userService.addPersonalInfo(req.user.id, dto, files);
            return { success: true, data: result };
        } catch (error) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                throw new BadRequestException('File size exceeds the 2MB limit.');
            }
            throw new BadRequestException('Failed to process nominee information.');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Patch('add-personal-info/update')
    @UseInterceptors(AnyFilesInterceptor(multerConfig))
    async updatePersonalInfo(@Request() req, @Body() dto: any, @UploadedFiles()
    files: {
        ProfileImage?: Express.Multer.File[];
        nidImageFrontPart?: Express.Multer.File[];
        nidImageBackPart?: Express.Multer.File[];
    },) {
        try {
            const result = await this.userService.addPersonalInfo(req.user.id, dto, files);
            return { success: true, data: result };
        } catch (error) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                throw new BadRequestException('File size exceeds the 2MB limit.');
            }
            throw new BadRequestException('Failed to process nominee information.');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Patch('add-nominee-info/update')
    @UseInterceptors(AnyFilesInterceptor(multerConfig))
    updateNomineeInfo(@Request() req, @Body() dto: any, @UploadedFiles()
    files: {
        ProfileImage?: Express.Multer.File[];
        nidImageFrontPart?: Express.Multer.File[];
        nidImageBackPart?: Express.Multer.File[];
    },) {
        return this.userService.addNomineeInfo(req.user.id, dto, files);
    }


    @UseGuards(JwtAuthGuard)
    @Post('add-nominee-info')
    @UseInterceptors(AnyFilesInterceptor(multerConfig))
    async addNomineeInfo(@Request() req, @Body() dto: any, @UploadedFiles()
    files: {
        // ProfileImage?: Express.Multer.File[];
        nidImageFrontPart?: Express.Multer.File[];
        nidImageBackPart?: Express.Multer.File[];
    },) {
        try {
            const result = await this.userService.addNomineeInfo(req.user.id, dto, files);
            return { success: true, data: result };
        } catch (error) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                throw new BadRequestException('File size exceeds the 2MB limit.');
            }
            throw new BadRequestException('Failed to process nominee information.');
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMyInfo(@Req() req) {
        const userId = req.user.id;
        return this.userService.getUserInfo(userId);
    }



    @UseGuards(JwtAuthGuard, RolesGuard) // Use JwtAuthGuard instead of AuthGuard('jwt')
    @Roles(Role.SUPER_ADMIN)
    @Delete('/:id')
    delete(@Request() req, @Param('id') id: number, @Body() deleteDto: { reason?: string },) {
        const adminId = req.user.id
        return this.userService.softDeleteUser(id, adminId, deleteDto.reason);

    }


}