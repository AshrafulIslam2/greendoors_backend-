import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { use } from 'passport';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepositService {
    constructor(private readonly prisma: PrismaService) { }
    private async checkIfDepositExistsForMonth(memberId: string, depositDate: Date) {
        const month = depositDate.getMonth() + 1;
        const year = depositDate.getFullYear();

        const existingDeposit = await this.prisma.depositInfo.findFirst({
            where: {
                memberId,
                month,
                year,
            },
        });

        if (existingDeposit) {
            throw new BadRequestException(
                "Deposit for this month already exists. Please select next month."
            );
        }
    }
    async addDeposit(dto: any) {
        if (!dto.amount || dto.amount <= 0 || isNaN(dto.amount)) {
            throw new BadRequestException('Deposit amount must be a positive number');
        }
        if (!dto.memberId || isNaN(dto.memberId)) {
            throw new BadRequestException('Invalid member ID');
        }
        const depositDate = new Date(dto.depositDate);
        if (isNaN(depositDate.getTime())) {
            throw new BadRequestException('Invalid deposit date');
        }

        await this.checkIfDepositExistsForMonth(dto.memberId, depositDate);

        const day = depositDate.getDate();
        const month = depositDate.getMonth() + 1;
        const year = depositDate.getFullYear();
        // const period = `${year}-${month.toString().padStart(2, '0')}`;
        const isLate = day > 15;
        const isFineWaived = !!dto.is_fine_waived;
        const lateFeeAmount = isLate && !isFineWaived ? 100 : 0;
        const adjustedDepositAmount = dto.amount - lateFeeAmount;
        console.log("🚀 ~ DepositService ~ addDeposit ~ adjustedDepositAmount:", adjustedDepositAmount)

        try {
            return await this.prisma.$transaction(async (prisma) => {
                const member = await prisma.memberInfo.findUnique({
                    where: { memberId: (dto.memberId) },
                });
                if (!member) {
                    throw new BadRequestException('Member not found');
                }

                const deposit = await prisma.depositInfo.create({
                    data: {
                        amount: adjustedDepositAmount,
                        notes: dto.notes || '',
                        lateFeeAmount: lateFeeAmount,
                        depositDate,
                        year,
                        month,
                        day,
                        is_fine_waived: isFineWaived,
                        isLate,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        member: { connect: { id: member.id } },
                    },
                });

                if (isLate && !isFineWaived) {
                    await prisma.lateFee.create({
                        data: {
                            amount: lateFeeAmount,
                            feeDate: depositDate,
                            memberId: (dto.memberId),
                            depositInfoId: deposit.id,
                        },
                    });
                }

                const cashBalance = await prisma.cashBalance.findFirst();
                const cashBalanceData = cashBalance || await prisma.cashBalance.create({
                    data: {
                        totalLateFee: 0,
                        totalDeposit: 0,
                        availableCash: 0,
                        updatedAt: new Date(),
                    },
                });

                await prisma.cashBalance.update({
                    where: { id: cashBalanceData.id },
                    data: {
                        totalLateFee: { increment: lateFeeAmount },
                        totalDeposit: { increment: adjustedDepositAmount },
                        availableCash: { increment: dto.amount },
                        updatedAt: new Date(),
                    },
                });

                const memberCashBalance = await prisma.cashBalanceMember.findUnique({
                    where: { memberId: (dto.memberId) },
                });
                if (memberCashBalance) {
                    await prisma.cashBalanceMember.update({
                        where: { memberId: (dto.memberId) },
                        data: {
                            totalDeposit: { increment: adjustedDepositAmount },
                            availableCash: { increment: adjustedDepositAmount },
                            totalLateFee: { increment: lateFeeAmount },
                            updatedAt: new Date(),
                        },
                    });
                } else {
                    await prisma.cashBalanceMember.create({
                        data: {
                            memberId: (dto.memberId),
                            totalDeposit: adjustedDepositAmount,
                            availableCash: adjustedDepositAmount,
                            totalLateFee: lateFeeAmount,
                            updatedAt: new Date(),
                        },
                    });
                }

                return deposit;
            });
        } catch (error) {
            throw new BadRequestException(`Failed to create deposit: ${error.message}`);
        }
    }
    async editDeposit(depositId: number, dto: any) {
        if (isNaN(depositId) || depositId <= 0) {
            throw new BadRequestException('Invalid deposit ID');
        }
        if (!dto.amount || dto.amount <= 0 || isNaN(dto.amount)) {
            throw new BadRequestException('Deposit amount must be a positive number');
        }
        if (!dto.memberId || isNaN(dto.memberId)) {
            throw new BadRequestException('Invalid member ID');
        }
        const depositDate = new Date(dto.depositDate);
        if (isNaN(depositDate.getTime())) {
            throw new BadRequestException('Invalid deposit date');
        }

        const existingDeposit = await this.prisma.depositInfo.findUnique({
            where: { id: Number(depositId) },
            include: { lateFee: true },
        });
        if (!existingDeposit) {
            throw new BadRequestException('Deposit record not found');
        }

        const day = depositDate.getDate();
        const month = depositDate.getMonth() + 1;
        const year = depositDate.getFullYear();

        const isLate = day > 15;
        const isFineWaived = !!dto.is_fine_waived;
        const lateFeeAmount = isLate && !isFineWaived ? 100 : 0;
        const adjustedDepositAmount = dto.amount - lateFeeAmount;
        console.log("🚀 ~ DepositService ~ addDeposit ~ adjustedDepositAmount:", adjustedDepositAmount)

        // Check for period conflict (excluding current deposit)


        try {
            return await this.prisma.$transaction(async (prisma) => {
                const originalDepositAmount = Number(existingDeposit.amount);
                const originalLateFee = Number(existingDeposit.lateFeeAmount || 0);
                const originalPaymentAmount = originalDepositAmount + originalLateFee;

                const depositDiff = adjustedDepositAmount - originalDepositAmount;
                const lateFeeDiff = lateFeeAmount - originalLateFee;
                const paymentDiff = dto.amount - originalPaymentAmount;

                const updatedDeposit = await prisma.depositInfo.update({
                    where: { id: Number(depositId) },
                    data: {
                        amount: adjustedDepositAmount,
                        depositDate,
                        lateFeeAmount: lateFeeAmount,
                        day,
                        month,
                        year,

                        isLate,
                        is_fine_waived: isFineWaived,
                        updatedAt: new Date(),
                    },
                });

                if (existingDeposit.lateFee) {
                    if (isLate && !isFineWaived) {
                        await prisma.lateFee.update({
                            where: { id: existingDeposit.lateFee.id },
                            data: {
                                amount: lateFeeAmount,
                                feeDate: depositDate,
                                memberId: (dto.memberId),
                            },
                        });
                    } else {
                        await prisma.lateFee.delete({
                            where: { id: existingDeposit.lateFee.id },
                        });
                    }
                } else if (isLate && !isFineWaived) {
                    await prisma.lateFee.create({
                        data: {
                            amount: lateFeeAmount,
                            feeDate: depositDate,
                            memberId: (dto.memberId),
                            depositInfoId: Number(depositId),
                        },
                    });
                }

                const cashBalance = await prisma.cashBalance.findFirst();
                if (cashBalance) {
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalDeposit: { increment: depositDiff },
                            totalLateFee: { increment: lateFeeDiff },
                            availableCash: { increment: paymentDiff },
                            updatedAt: new Date(),
                        },
                    });
                }

                const memberCashBalance = await prisma.cashBalanceMember.findUnique({
                    where: { memberId: (dto.memberId) },
                });
                if (memberCashBalance) {
                    await prisma.cashBalanceMember.update({
                        where: { memberId: (dto.memberId) },
                        data: {
                            totalDeposit: { increment: depositDiff },
                            totalLateFee: { increment: lateFeeDiff },
                            availableCash: { increment: depositDiff },
                            updatedAt: new Date(),
                        },
                    });
                }

                return updatedDeposit;
            });
        } catch (error) {
            throw new BadRequestException(`Failed to update deposit: ${error.message}`);
        }
    }
    async deleteDeposit(depositId: number) {
        if (isNaN(depositId) || depositId <= 0) {
            throw new BadRequestException('Invalid deposit ID');
        }

        try {
            return await this.prisma.$transaction(async (prisma) => {
                const deposit = await prisma.depositInfo.findUnique({
                    where: { id: Number(depositId) },
                    include: { lateFee: true, member: true },
                });
                if (!deposit) {
                    throw new BadRequestException('Deposit record not found');
                }

                const depositAmount = Number(deposit.amount);
                const lateFeeAmount = Number(deposit.lateFeeAmount || 0);
                const paymentAmount = depositAmount + lateFeeAmount;

                if (deposit.lateFee) {
                    await prisma.lateFee.delete({
                        where: { id: deposit.lateFee.id },
                    });
                }

                await prisma.depositInfo.delete({
                    where: { id: Number(depositId) },
                });

                const cashBalance = await prisma.cashBalance.findFirst();
                if (cashBalance) {
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalDeposit: { decrement: depositAmount },
                            totalLateFee: { decrement: lateFeeAmount },
                            availableCash: { decrement: paymentAmount },
                            updatedAt: new Date(),
                        },
                    });
                }

                const memberCashBalance = await prisma.cashBalanceMember.findUnique({
                    where: { memberId: deposit.member.memberId },
                });
                if (memberCashBalance) {
                    await prisma.cashBalanceMember.update({
                        where: { memberId: deposit.member.memberId },
                        data: {
                            totalDeposit: { decrement: depositAmount },
                            availableCash: { decrement: depositAmount },
                            totalLateFee: { decrement: lateFeeAmount },
                            updatedAt: new Date(),
                        },
                    });
                }
                return deposit;
            });
        } catch (error) {
            throw new BadRequestException(`Failed to delete deposit: ${error.message}`);
        }
    }
    async getDeposit(page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // 1. Paginated deposit data with member and lateFee
        const deposits = await this.prisma.depositInfo.findMany({
            include: {
                member: true,
                lateFee: true,
            },
            orderBy: {
                depositDate: 'desc',
            },
            skip,
            take: Number(limit),
        });

        // 2. Total count of all deposit records
        const totalCount = await this.prisma.depositInfo.count();

        // 3. Total deposited amount
        const depositSum = await this.prisma.depositInfo.aggregate({
            _sum: {
                amount: true,
            },
        });

        // 4. Total late fee amount
        const lateFeeSum = await this.prisma.lateFee.aggregate({
            _sum: {
                amount: true,
            },
        });

        return {
            data: deposits,
            pagination: {
                totalCount,
                currentPage: page,
                perPage: limit,
                totalPages: Math.ceil(totalCount / limit),
            },
            totals: {
                totalDepositAmount: depositSum._sum.amount || 0,
                totalLateFeeAmount: lateFeeSum._sum.amount || 0,
            },
        };
    }
    async getDepositById(memberId: string, page = 1, limit = 10) {
        console.log("🚀 ~ DepositService ~ getDepositById ~ memberId:", memberId)
        const skip = (page - 1) * limit;

        // 1. Paginated data
        const deposits = await this.prisma.depositInfo.findMany({
            where: { memberId },
            include: {
                lateFee: true,
            },
            orderBy: {
                depositDate: 'desc',
            },
            skip,
            take: Number(limit),
        });
        console.log("🚀 ~ DepositService ~ getDepositById ~ deposits:", deposits)

        // 2. Total count
        const totalCount = await this.prisma.depositInfo.count({
            where: { memberId },
        });

        // 3. Total deposited amount
        const depositSum = await this.prisma.depositInfo.aggregate({
            where: { memberId },
            _sum: {
                amount: true,
            },
        });

        // 4. Total late fee amount
        const lateFeeSum = await this.prisma.lateFee.aggregate({
            where: { memberId },
            _sum: {
                amount: true,
            },
        });

        return {
            data: deposits,
            pagination: {
                totalCount,
                currentPage: page,
                perPage: limit,
                totalPages: Math.ceil(totalCount / limit),
            },
            totals: {
                totalDepositAmount: depositSum._sum.amount || 0,
                totalLateFeeAmount: lateFeeSum._sum.amount || 0,
            },
        };
    }

    async getCashBalance() {
        try {
            const data = await this.prisma.cashBalance.findFirst();
            if (data) {
                return {
                    status: "success",
                    message: "Cash balance fetched successfully.",
                    data,
                };
            } else {
                return {
                    status: "fail",
                    message: "No cash balance record found.",
                    data: null,
                };
            }
        } catch (error) {
            return {
                status: "fail",
                message: error.message || "Failed to fetch cash balance.",
                data: null,
            };
        }
    }
    async memberCashBalance(memberId: string) {
        try {
            const data = await this.prisma.cashBalanceMember.findFirst({
                where: { memberId }, select: {
                    totalDeposit: true,
                    availableCash: true,
                    totalLateFee: true,
                    totalLoss: true,
                    totalProfit: true,
                    updatedAt: true,
                },
            });
            if (data) {
                return {
                    status: "success",
                    message: "Member cash balance fetched successfully.",
                    data,
                };
            } else {
                return {
                    status: "fail",
                    message: "No cash balance record found for this member.",
                    data: null,
                };
            }
        } catch (error) {
            return {
                status: "fail",
                message: error.message || "Failed to fetch member cash balance.",
                data: null,
            };
        }
    }

}
