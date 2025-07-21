import { BadRequestException, Injectable } from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DepositService {
    constructor(private readonly prisma: PrismaService) { }
    async addDeposit(dto: any) {
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
        const lateFeeAmount = isLate ? 100 : 0;
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
                        amount: adjustedDepositAmount,
                        depositDate,
                        year,
                        month,
                        day,
                        // memberId: "1901",
                        member: {
                            connect: { id: member.id },
                        },
                    },
                });
                if (dto.is_fine_waived) {
                    await prisma.lateFee.create({
                        data: {
                            amount: 0,
                            feeDate: depositDate,
                            memberId: dto.memberId,
                            depositInfoId: deposit.id,
                        },
                    });
                }
                else {
                    await prisma.lateFee.create({
                        data: {
                            amount: lateFeeAmount,
                            feeDate: depositDate,
                            memberId: dto.memberId,
                            depositInfoId: deposit.id,
                        },
                    });
                }

                const cashBalance = await prisma.cashBalance.findFirst();
                if (cashBalance) {
                    await prisma.cashBalance.update({
                        where: { id: cashBalance.id },
                        data: {
                            totalLateFee: {
                                increment: dto.is_fine_waived ? 0 : lateFeeAmount,
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
                return deposit; // ✅ Return the created deposit
            });

            return result; // ✅ Return from the outer function
        } catch (error) {
            throw new BadRequestException("Failed to create deposit: " + error.message);
        }
    }

}
