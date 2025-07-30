import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import axios from 'axios';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class UserService {
    private readonly logger = new Logger(UserService.name);

    constructor(private readonly prisma: PrismaService, private emailService: EmailService,) { }

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
            const result = await this.prisma.$transaction(async (prisma) => {
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
                                totalRegistrationFee: dto.registrationAmount,
                                availableCash: dto.registrationAmount,
                                updatedAt: new Date(),
                            },
                        });
                    }
                }

                return { ...user, password: dto.password };
            });

            // Send welcome email after successful user creation
            try {
                const emailSent = await this.emailService.sendWelcomeEmail(
                    dto.email,
                    dto.name,
                    dto.password,
                    dto.memberId,
                );

                if (emailSent) {
                    this.logger.log(`Welcome email sent successfully to ${dto.email}`);
                } else {
                    this.logger.warn(`Failed to send welcome email to ${dto.email}, but user creation succeeded`);
                }
            } catch (emailError) {
                // Log email error but don't fail the entire operation
                this.logger.error('Failed to send welcome email:', emailError);
                // You might want to add the email to a queue for retry
            }

            // Don't return the plain password in the response
            const { password: _, ...userWithoutPassword } = result;
            return userWithoutPassword;

        } catch (error) {
            this.logger.error("Failed to create member:", error);
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new BadRequestException(
                    `A user with the member ID '${dto.memberId}' or email '${dto.email}' already exists. Please use a different member ID or email.`,
                );
            }
            throw error;
        }
    }


    //add Personal Info and update member personal info
    async addPersonalInfo(userId: number, dto: any, files) {
        const existingInfo = await this.prisma.userPersonalInfo.findFirst({
            where: {
                user: { id: userId },
            },
        });

        const fileMap = files?.reduce((acc, file) => {
            if (!acc[file.fieldname]) {
                acc[file.fieldname] = [];
            }
            acc[file.fieldname].push(file);
            return acc;
        }, {} as Record<string, Express.Multer.File[]>);

        const profileImageUrl = fileMap.ProfileImage
            ? await this.uploadToImgBB(fileMap.ProfileImage[0])
            : existingInfo?.ProfileImage || null;
        const nidFrontUrl = fileMap.nidImageFrontPart
            ? await this.uploadToImgBB(fileMap.nidImageFrontPart[0])
            : existingInfo?.nidImageFrontPart || null;
        const nidBackUrl = fileMap.nidImageBackPart
            ? await this.uploadToImgBB(fileMap.nidImageBackPart[0])
            : existingInfo?.nidImageBackPart || null;

        // Use transaction to ensure both updates happen together
        const result = await this.prisma.$transaction(async (prisma) => {
            let updatedInfo;

            if (existingInfo) {
                updatedInfo = await prisma.userPersonalInfo.update({
                    where: { id: existingInfo.id },
                    data: {
                        ...dto,
                        ProfileImage: profileImageUrl,
                        nidImageFrontPart: nidFrontUrl,
                        nidImageBackPart: nidBackUrl,
                    },
                });
            } else {
                updatedInfo = await prisma.userPersonalInfo.create({
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
                });

                // Connect the personal info to user if it's a new record
                await prisma.user.update({
                    where: {
                        id: userId
                    },
                    data: {
                        personalInfo: {
                            connect: {
                                id: updatedInfo.id
                            }
                        }
                    }
                });
            }

            // Update User table if name or email is provided in dto
            const userUpdateData: any = {};
            if (dto.name !== undefined) {
                userUpdateData.name = dto.name;
            }
            if (dto.email !== undefined) {
                userUpdateData.email = dto.email;
            }

            // Only update User table if there are fields to update
            if (Object.keys(userUpdateData).length > 0) {
                await prisma.user.update({
                    where: { id: userId },
                    data: userUpdateData
                });
            }

            return updatedInfo;
        });

        return result;
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

    //Get All Members Table
    async getUsers(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const users = await this.prisma.user.findMany({
            where: {
                isDeleted: false,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                email: true,
                userPersonalInfoId: true,
                nomineeId: true,
                memberInfoId: true,
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
        const totalCount = await this.prisma.user.count({
            where: {
                isDeleted: false,
                isActive: true
            }
        });
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




    // Updated softDeleteUser method
    async softDeleteUser(userId: number, deletedByAdminId: number, reason?: string) {
        return await this.prisma.$transaction(async (prisma) => {
            const user = await prisma.user.findUnique({
                where: { id: Number(userId) },
                include: { member: true }
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }

            if (user.isDeleted) {
                throw new BadRequestException('User is already deleted');
            }

            const { hasFinancialData, hasOnlyRegistration } = await this.checkFinancialTransactions(userId);

            if (hasFinancialData) {
                // Soft delete for users with significant financial data
                const deletedUser = await prisma.user.update({
                    where: { id: Number(userId) },
                    data: {
                        isActive: false,
                        isDeleted: true,
                        deletedAt: new Date(),
                        deletedBy: deletedByAdminId,
                        deletionReason: reason,
                        email: `deleted_${userId}_${Date.now()}@deleted.local`
                    }
                });

                if (user.member) {
                    await prisma.memberInfo.update({
                        where: { id: Number(user.member.id) },
                        data: {
                            isActive: false,
                            isDeleted: true,
                            deletedAt: new Date()
                        }
                    });
                }

                return {
                    message: 'User soft deleted successfully',
                    user: deletedUser,
                    preservedData: 'Financial records preserved'
                };
            } else {
                // Hard delete for users with no financial data or only registration fee
                const result = await this.hardDeleteUser(userId);
                return {
                    ...result,
                    note: hasOnlyRegistration
                        ? 'User had only registration fee - safe to delete'
                        : 'User had no financial data - safe to delete'
                };
            }
        });
    }
    // Updated softDeleteUser method Supportive function
    private async checkFinancialTransactions(userId: number): Promise<{ hasFinancialData: boolean, hasOnlyRegistration: boolean }> {
        const user = await this.prisma.user.findUnique({
            where: {
                id: Number(userId)
            },
            include: {
                member: {
                    include: {
                        deposits: true,
                        registrationFeeInfo: true,
                        lateFees: true,
                        PettyCashExpense: true,
                        Investment: true
                    }
                }
            }
        });

        if (!user?.member) return { hasFinancialData: false, hasOnlyRegistration: false };

        const hasDeposits = user.member.deposits.length > 0;
        const hasLateFees = user.member.lateFees.length > 0;
        const hasPettyCash = user.member.PettyCashExpense.length > 0;
        const hasInvestments = user.member.Investment.length > 0;
        const hasRegistrationFee = !!user.member.registrationFeeInfo;

        const hasSignificantFinancialData = hasDeposits || hasLateFees || hasPettyCash || hasInvestments;
        const hasOnlyRegistration = hasRegistrationFee && !hasSignificantFinancialData;

        return {
            hasFinancialData: hasSignificantFinancialData,
            hasOnlyRegistration
        };
    }
    ///Hard Delete Function if on have registration Fee
    private async hardDeleteUser(userId: number) {
        return await this.prisma.$transaction(async (prisma) => {
            const user = await prisma.user.findUnique({
                where: { id: Number(userId) },
                include: {
                    member: {
                        include: {
                            registrationFeeInfo: true
                        }
                    },
                    personalInfo: true,
                    nominee: true
                }
            });

            if (!user) {
                throw new NotFoundException('User not found');
            }
            let registrationAmount = 0;
            // Delete in correct order due to foreign key constraints

            // 1. Delete member-related data if member exists
            if (user.member) {
                // Delete registration fee info (this is okay to delete for new members)
                if (user.member.registrationFeeInfo) {
                    registrationAmount = Number(user.member.registrationFeeInfo.amount);
                    await prisma.registrationFeeInfo.delete({
                        where: { memberId: user.member.memberId }
                    });
                }

                // Delete member info
                await prisma.memberInfo.delete({
                    where: { id: user.member.id }
                });
            }

            // 2. Delete personal info if exists
            if (user.personalInfo) {
                await prisma.userPersonalInfo.delete({
                    where: { id: user.personalInfo.id }
                });
            }

            // 3. Delete nominee if exists
            if (user.nominee) {
                await prisma.nominee.delete({
                    where: { id: user.nominee.id }
                });
            }
            // 4. Update CashBalance if there was a registration fee
            if (registrationAmount > 0) {
                const cashBalance = await prisma.cashBalance.findFirst();

                if (cashBalance) {
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalRegistrationFee: {
                                decrement: registrationAmount,
                            },
                            availableCash: {
                                decrement: registrationAmount,
                            },
                            updatedAt: new Date(),
                        },
                    });
                }
            }
            // 5. Finally delete the user
            await prisma.user.delete({
                where: { id: Number(userId) }
            });

            return {
                message: 'User and all related data permanently deleted',
                deletedUserId: userId,
                note: 'User had only registration fee, safe to hard delete'
            };
        });
    }
}
