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
        console.log("dto", dto);
        if (!dto.amount || dto.amount <= 0) {
            throw new BadRequestException("Deposit amount must be greater than zero");
        }


        const depositDate = new Date(dto.depositDate);
        if (!depositDate || isNaN(new Date(depositDate).getTime())) {
            throw new BadRequestException("Invalid deposit date");
        }
        await this.checkIfDepositExistsForMonth(dto.memberId, depositDate);
        const day = depositDate.getDate();
        const month = depositDate.getMonth() + 1;
        const year = depositDate.getFullYear();
        const isLate = day > 15;
        const isFineWaived = dto.is_fine_waived;
        const lateFeeAmount = isLate && !isFineWaived ? 100 : 0;
        const adjustedDepositAmount = dto.amount - lateFeeAmount;

        try {
            const result = await this.prisma.$transaction(async (prisma) => {
                const member = await prisma.memberInfo.findUnique({
                    where: {
                        memberId: dto.memberId,
                    },
                });

                if (!member) {
                    throw new BadRequestException("Member not found");
                }

                const deposit = await prisma.depositInfo.create({
                    data: {
                        amount: dto.amount,
                        notes: dto.notes || '',
                        lateFeeAmount: isLate ? lateFeeAmount : 0, // Store late fee amount if applicable
                        depositDate,
                        year,
                        month,
                        day,
                        is_fine_waived: dto.is_fine_waived || dto.is_fine_waved || false,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        member: {
                            connect: { id: member.id },
                        },
                    },
                });

                // Only create late fee record if there's actually a late fee (not waived and date > 15)
                if (isLate && !isFineWaived) {
                    await prisma.lateFee.create({
                        data: {
                            amount: lateFeeAmount,
                            feeDate: depositDate,
                            memberId: dto.memberId,
                            depositInfoId: deposit.id,
                        },
                    });
                }

                // Update global cash balance
                const cashBalance = await prisma.cashBalance.findFirst();
                if (cashBalance) {
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalLateFee: {
                                increment: isFineWaived ? 0 : lateFeeAmount,
                            },
                            totalDeposit: {
                                increment: dto.amount,
                            },
                            availableCash: {
                                increment: dto.amount,
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

                // Update or create member cash balance
                const memberCashBalance = await prisma.cashBalanceMember.findUnique({
                    where: { memberId: dto.memberId },
                });
                if (memberCashBalance) {
                    await prisma.cashBalanceMember.update({
                        where: { memberId: dto.memberId },
                        data: {
                            totalDeposit: { increment: adjustedDepositAmount },
                            availableCash: { increment: adjustedDepositAmount },
                            totalLateFee: { increment: isFineWaived ? 0 : lateFeeAmount },
                            updatedAt: new Date(),
                        },
                    });
                } else {
                    await prisma.cashBalanceMember.create({
                        data: {
                            memberId: dto.memberId,
                            totalDeposit: adjustedDepositAmount,
                            availableCash: adjustedDepositAmount,
                            totalLateFee: isFineWaived ? 0 : lateFeeAmount,
                            updatedAt: new Date(),
                        },
                    });
                }

                return deposit; // ✅ Return the created deposit
            });

            return result; // ✅ Return from the outer function
        } catch (error) {
            throw new BadRequestException("Failed to create deposit: " + error.message);
        }
    }
    async editDeposit(depositId: number, dto: any) {
        const existingDeposit = await this.prisma.depositInfo.findUnique({
            where: { id: Number(depositId) },
            include: { lateFee: true },
        });

        if (!existingDeposit) {
            throw new BadRequestException("Deposit record not found");
        }

        if (!dto.amount || dto.amount <= 0) {
            throw new BadRequestException("Deposit amount must be greater than zero");
        }

        if (!dto.depositData || isNaN(new Date(dto.depositData).getTime())) {
            throw new BadRequestException("Invalid deposit date");
        }

        const depositDate = new Date(dto.depositData);
        const day = depositDate.getDate();
        const month = depositDate.getMonth() + 1;
        const year = depositDate.getFullYear();
        const isLate = day > 15;
        const lateFeeAmount = isLate && !dto.is_fine_waived ? 100 : 0;
        const adjustedDepositAmount = dto.amount - lateFeeAmount;

        try {
            const result = await this.prisma.$transaction(async (prisma) => {
                // 1. Update depositInfo
                const updatedDeposit = await prisma.depositInfo.update({
                    where: { id: Number(depositId) },
                    data: {
                        amount: adjustedDepositAmount,
                        depositDate,
                        lateFeeAmount: isLate ? lateFeeAmount : 0,
                        day,
                        month,
                        year,
                    },
                });

                // 2. Update or create lateFee
                if (existingDeposit.lateFee) {
                    if (isLate && !dto.is_fine_waived) {
                        // Update existing late fee
                        await prisma.lateFee.update({
                            where: { id: existingDeposit.lateFee.id },
                            data: {
                                amount: lateFeeAmount,
                                feeDate: depositDate,
                                memberId: dto.memberId,
                            },
                        });
                    } else {
                        // Delete existing late fee if fine is waived or not late
                        await prisma.lateFee.delete({
                            where: { id: existingDeposit.lateFee.id },
                        });
                    }
                } else if (isLate && !dto.is_fine_waived) {
                    // Create new late fee only if late and not waived
                    await prisma.lateFee.create({
                        data: {
                            amount: lateFeeAmount,
                            feeDate: depositDate,
                            memberId: dto.memberId,
                            depositInfoId: Number(depositId),
                        },
                    });
                }

                // 3. Adjust cash balance
                const cashBalance = await prisma.cashBalance.findFirst();

                if (cashBalance) {
                    // Get original values
                    const originalDepositAmount = existingDeposit.amount as Prisma.Decimal;
                    const originalLateFee = existingDeposit.lateFeeAmount
                        ? (existingDeposit.lateFeeAmount as Prisma.Decimal)
                        : new Prisma.Decimal(0);

                    // Convert Prisma.Decimal to number for calculations
                    const originalDepositAmountNum = originalDepositAmount.toNumber();
                    const originalLateFeeNum = originalLateFee.toNumber();

                    // Calculate differences

                    const depositDiff = dto.amount - originalDepositAmountNum; // Change in deposit amount
                    const lateFeeDiff = lateFeeAmount - originalLateFeeNum; // Change in late fee

                    // Update cash balance
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalDeposit: {
                                increment: depositDiff,
                            },
                            totalLateFee: {
                                increment: lateFeeDiff,
                            },
                            availableCash: {
                                increment: depositDiff + lateFeeDiff, // Total change in cash
                            },
                            updatedAt: new Date(),
                        },
                    });
                }

                return updatedDeposit;
            });

            return result;
        } catch (error) {
            throw new BadRequestException("Failed to update deposit: " + error.message);
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
    async deleteDeposit(depositId: number) {
        console.log("🚀 ~ DepositService ~ deleteDeposit ~ depositId:", depositId)
        try {
            const result = await this.prisma.$transaction(async (prisma) => {
                // 1. Fetch the deposit with its related late fee
                const deposit = await prisma.depositInfo.findUnique({
                    where: { id: Number(depositId) },
                    include: { lateFee: true, member: true },
                });
                console.log("🚀 ~ DepositService ~ deleteDeposit ~ deposit:", deposit)

                if (!deposit) {
                    throw new BadRequestException('Deposit record not found');
                }

                // // 2. Delete the associated late fee (if it exists)
                if (deposit.lateFee) {
                    await prisma.lateFee.delete({
                        where: { id: deposit.lateFee.id },
                    });
                }

                // // 3. Delete the deposit
                await prisma.depositInfo.delete({
                    where: { id: Number(depositId) },
                });

                // // 4. Update cash balance
                const cashBalance = await prisma.cashBalance.findFirst();

                if (cashBalance) {
                    // Get deposit and late fee amounts
                    const depositAmount = deposit.amount as Prisma.Decimal;
                    const lateFeeAmount = deposit.lateFee?.amount
                        ? (deposit.lateFee.amount as Prisma.Decimal)
                        : new Prisma.Decimal(0);

                    // Convert to numbers for arithmetic
                    const depositAmountNum = depositAmount.toNumber();
                    const lateFeeAmountNum = lateFeeAmount.toNumber();

                    // Update cash balance
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalDeposit: {
                                decrement: depositAmountNum - lateFeeAmountNum, // Adjust for late fee
                            },
                            totalLateFee: {
                                decrement: lateFeeAmountNum,
                            },
                            availableCash: {
                                decrement: depositAmountNum - lateFeeAmountNum,
                            },
                            updatedAt: new Date(),
                        },
                    });
                }
                //<!-- 5. Update member cash balance -->
                const memberCashBalance = await prisma.cashBalanceMember.findUnique({
                    where: { memberId: deposit.member.memberId },
                });

                if (memberCashBalance) {
                    // Get deposit and late fee amounts
                    const depositAmount = deposit.amount as Prisma.Decimal;
                    const lateFeeAmount = deposit.lateFee?.amount
                        ? (deposit.lateFee.amount as Prisma.Decimal)
                        : new Prisma.Decimal(0);

                    // Convert to numbers for arithmetic
                    const depositAmountNum = depositAmount.toNumber();
                    const lateFeeAmountNum = lateFeeAmount.toNumber();

                    // Update member cash balance
                    await prisma.cashBalanceMember.update({
                        where: { memberId: deposit.memberId },
                        data: {
                            totalDeposit: {
                                decrement: depositAmountNum,
                            },
                            availableCash: {
                                decrement: depositAmountNum,
                            },
                            totalLateFee: {
                                decrement: lateFeeAmountNum,
                            },
                            updatedAt: new Date(),
                        },
                    });
                }

                return deposit;
            });

            return result;
        } catch (error) {
            throw new BadRequestException('Failed to delete deposit: ' + error.message);
        }
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
