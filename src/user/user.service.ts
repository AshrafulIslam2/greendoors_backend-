/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) { }

    async createMember(dto: any) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        return this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                name: dto.name,
                role: dto.role || Role.MEMBER,
                member: {
                    create: {
                        memberId: dto.memberId,
                        joiningDate: dto.joiningDate,
                        type: dto.role || 'MEMBER',
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
                deposits: true,
                fines: true,
            },
        });
    }
}
