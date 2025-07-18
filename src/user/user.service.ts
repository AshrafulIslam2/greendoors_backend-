import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) { }
    private async uploadToImgBB(file: Express.Multer.File): Promise<string> {
        console.log("ash", file)
        const base64 = file.buffer.toString('base64');

        const formData = new URLSearchParams();
        formData.append('image', base64);

        const response = await axios.post(
            'https://api.imgbb.com/1/upload?key=ec3e94443bef2d7363a15f86c0374146',
            formData
        );

        return response.data.data.url;
    }

    async createMember(memberId, dto: any) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        return this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                name: dto.name,
                role: Role.MEMBER,
                member: {
                    create: {
                        memberId: dto.memberId,
                        joiningDate: dto.joiningDate,
                        type: dto.role || 'MEMBER',
                        registrationFeeInfo: dto.registrationAmount ? {
                            create: {
                                amount: dto.registrationAmount,
                                receivedAt: new Date(),
                                receivedBy: memberId,
                            }
                        } : undefined
                    },
                },

            },
            include: {
                member: true,
            },
        });
    }
    async addPersonalInfo(userId: number, dto: any, files) {
        const existingInfo = await this.prisma.userPersonalInfo.findFirst({
            where: {
                user: { id: userId }, // Assumes userId is the foreign key in userPersonalInfo
            },
        });
        console.log(existingInfo)
        const fileMap = files.reduce((acc, file) => {
            if (!acc[file.fieldname]) {
                acc[file.fieldname] = [];
            }
            acc[file.fieldname].push(file);
            return acc;
        }, {} as Record<string, Express.Multer.File[]>);;
        console.log("===========", fileMap)
        const profileImageUrl = fileMap.ProfileImage
            ? await this.uploadToImgBB(fileMap.ProfileImage[0])
            : null;
        const nidFrontUrl = fileMap.nidImageFrontPart
            ? await this.uploadToImgBB(fileMap.nidImageFrontPart[0])
            : null;
        const nidBackUrl = fileMap.nidImageBackPart
            ? await this.uploadToImgBB(fileMap.nidImageBackPart[0])
            : null;

        if (existingInfo) {
            const updatedInfo = await this.prisma.userPersonalInfo.update({
                where: { id: existingInfo.id },
                data: {
                    ...dto,
                    ProfileImage: profileImageUrl,
                    nidImageFrontPart: nidFrontUrl,
                    nidImageBackPart: nidBackUrl,
                },
            });
            return updatedInfo;
        }
        const info = await this.prisma.userPersonalInfo.create({
            data: {
                ...dto,
                ProfileImage: profileImageUrl,
                nidImageFrontPart: nidFrontUrl,
                nidImageBackPart: nidBackUrl,
                user: {
                    connect: {
                        id: userId
                    }
                }
            }
        })

        await this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                personalInfo: {
                    connect: {
                        id: info.id
                    }
                }
            }
        })

        return info;

    }

    async addNomineeInfo(userId: number, dto) {
        const nominee = await this.prisma.nominee.create({
            data: {
                ...dto,
                user: {
                    connect: { id: userId },
                },
            },
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                nominee: {
                    connect: { id: nominee.id },
                },
            },
        });

        return nominee;
    }

    async updatePersonalInfo(userId: number, dto: any) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }, select: {
                userPersonalInfoId: true
            }
        });
        if (!user?.userPersonalInfoId) {
            throw new NotFoundException('User or personal info not found');
        }
        const data: any = {};
        if (dto.name !== undefined) data.name = dto.name;
        if (dto.phone !== undefined) data.phone = dto.phone;
        if (dto.email !== undefined) data.email = dto.email;
        if (dto.dob !== undefined) data.dob = new Date(dto.dob);
        if (dto.address !== undefined) data.address = dto.address;
        if (dto.nid !== undefined) data.nid = dto.nid;
        return this.prisma.userPersonalInfo.update({
            where: { id: user.userPersonalInfoId },
            data,
        });
    }
    async updateNomineeInfo(userId: number, dto: any) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }, select: {
                nominee: true
            }
        });
        if (!user?.nominee) {
            throw new NotFoundException('User or personal info not found');
        }
        const data: any = {};
        if (dto.name !== undefined) data.name = dto.name;
        if (dto.phone !== undefined) data.phone = dto.phone;
        if (dto.email !== undefined) data.email = dto.email;
        if (dto.dob !== undefined) data.dob = new Date(dto.dob);
        if (dto.address !== undefined) data.address = dto.address;
        if (dto.nid !== undefined) data.nid = dto.nid;
        return this.prisma.nominee.update({
            where: { id: user.nominee.id },
            data,
        });
    }
    async getUserInfo(userId: number) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                personalInfo: true,
                nominee: true,
                member: true,
            },
        });
    }
}
