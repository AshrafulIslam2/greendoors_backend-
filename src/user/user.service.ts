import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { create } from 'domain';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) { }

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
    async addPersonalInfo(userId, dto: any) {
        const info = await this.prisma.userPersonalInfo.create({
            data: {
                ...dto,
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
