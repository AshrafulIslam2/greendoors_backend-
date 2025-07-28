import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
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

    async createMember(memberId: string, dto: any) {
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        try {
            return await this.prisma.$transaction(async (prisma) => {
                // Create the user and associated member
                const user = await prisma.user.create({
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
                                registrationFeeInfo: dto.registrationAmount
                                    ? {
                                        create: {
                                            amount: dto.registrationAmount,
                                            receivedAt: new Date(),
                                            receivedBy: memberId,
                                        },
                                    }
                                    : undefined,
                            },
                        },
                    },
                    include: {
                        member: true,
                    },
                });

                // If there's a registration fee, update the CashBalance
                if (dto.registrationAmount) {
                    const cashBalance = await prisma.cashBalance.findFirst();

                    if (cashBalance) {
                        await prisma.cashBalance.update({
                            where: { id: cashBalance.id },
                            data: {
                                totalRegistrationFee: {
                                    increment: dto.registrationAmount,
                                },
                                availableCash: {
                                    increment: dto.registrationAmount,
                                },
                                updatedAt: new Date(),
                            },
                        });
                    } else {
                        await prisma.cashBalance.create({
                            data: {
                                totalDeposit: dto.registrationAmount,
                                availableCash: dto.registrationAmount,
                                updatedAt: new Date(),
                            },
                        });
                    }
                }

                return { ...user, password: dto.password };
            });
        } catch (error) {
            console.log("🚀 ~ UserService ~ createMember ~ error:", error)
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new BadRequestException(
                    `A user with the member ID '${dto.memberId}' or  '${dto.email}'already exists. Please use a different member ID. or Email`,
                );
            }
            // Rethrow other errors to be handled by a global exception filter or controller
            throw error;
        }
    }


    //add Personal Info and update member personal info
    async addPersonalInfo(userId: number, dto: any, files) {
        const existingInfo = await this.prisma.userPersonalInfo.findFirst({
            where: {
                user: { id: userId }, // Assumes userId is the foreign key in userPersonalInfo
            },
        });

        const fileMap = files?.reduce((acc, file) => {
            if (!acc[file.fieldname]) {
                acc[file.fieldname] = [];
            }
            acc[file.fieldname].push(file);
            return acc;
        }, {} as Record<string, Express.Multer.File[]>);;
        const profileImageUrl = fileMap.ProfileImage
            ? await this.uploadToImgBB(fileMap.ProfileImage[0])
            : existingInfo?.ProfileImage || null;
        const nidFrontUrl = fileMap.nidImageFrontPart
            ? await this.uploadToImgBB(fileMap.nidImageFrontPart[0])
            : existingInfo?.nidImageFrontPart || null;
        const nidBackUrl = fileMap.nidImageBackPart
            ? await this.uploadToImgBB(fileMap.nidImageBackPart[0])
            : existingInfo?.nidImageBackPart || null;

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

    //add nominee info and update nominee info
    async addNomineeInfo(userId: number, dto, files) {

        const existingInfo = await this.prisma.nominee.findFirst({
            where: {
                user: { id: userId }, // Assumes userId is the foreign key in userPersonalInfo
            },
        });
        console.log("===ash", existingInfo)
        const fileMap = files?.reduce((acc, file) => {
            if (!acc[file.fieldname]) {
                acc[file.fieldname] = [];
            }
            acc[file.fieldname].push(file);
            return acc;
        }, {} as Record<string, Express.Multer.File[]>);;
        const nidFrontUrl = fileMap.nidImageFrontPart
            ? await this.uploadToImgBB(fileMap.nidImageFrontPart[0])
            : existingInfo?.nidImageFrontPart || null;
        const nidBackUrl = fileMap.nidImageBackPart
            ? await this.uploadToImgBB(fileMap.nidImageBackPart[0])
            : existingInfo?.nidImageBackPart || null;

        if (existingInfo) {
            const updatedNominee = await this.prisma.nominee.update({
                where: { id: existingInfo.id },
                data: {
                    ...dto,
                    nidImageFrontPart: nidFrontUrl,
                    nidImageBackPart: nidBackUrl,
                },
            });
            return updatedNominee;
        }
        const nominee = await this.prisma.nominee.create({
            data: {
                ...dto,
                nidImageFrontPart: nidFrontUrl,
                nidImageBackPart: nidBackUrl,
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
            },
        });
    }
    async getUsers(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const users = await this.prisma.user.findMany({
            include: {
                personalInfo: true,
                nominee: true,
                member: true,
            },
            orderBy: {
                id: 'asc',
            },
            skip,
            take: Number(limit),
        });
        const totalCount = await this.prisma.user.count();
        return {
            data: users,
            pagination: {
                totalCount,
                currentPage: page,
                perPage: limit,
                totalPages: Math.ceil(totalCount / limit),
            },
            message: 'success'
        }
    }
    async deleteUser(id: number) {
        const user = await this.prisma.user.delete({
            where: { id: Number(id) },
            include: {
                member: true,
            },
        })
        return {
            status: "success",
            message: "deleted successfully"
        }
    }
}
