import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'; // ✅



const prisma = new PrismaClient()

async function main() {
    const existingCashBalance = await prisma.cashBalance.findFirst();
    let cashBalance
    if (!existingCashBalance) {
        cashBalance = await prisma.cashBalance.create({
            data: {
                totalDeposit: 0,
                totalExpense: 0,
                totalInvestment: 0,
                totalProfit: 0,
                totalLoss: 0,
                availableCash: 0,
                totalLateFee: 0,
                totalRegistrationFee: 0,
                updatedAt: new Date(),
            },
        });
        console.log('✅ CashBalance record created.');
    } else {
        cashBalance = existingCashBalance;
        console.log('ℹ️ CashBalance already exists.');
    }
    console.log("🚀 ~ main ~ cashBalance:", cashBalance)

    const email = 'admin@example.com'
    const password = '12345'
    const hashedPassword = await hash(password, 10); // Use the imported hash function
    const superAdmin = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            name: 'Rasel Riaz Chowdhury',
            member: {
                create: {
                    memberId: '1900',
                    type: 'Founder',
                    joiningDate: new Date('2019-10-01'),
                    registrationFeeInfo: {
                        create: {
                            amount: 500,
                            receivedAt: new Date('2019-10-01'),
                            receivedBy: "1900",
                        }
                    }
                }
            }
        },
    })
    if (cashBalance?.id) {
        console.log("🚀 ~ main ~ updating cashBalance:", cashBalance)
        await prisma.cashBalance.update({
            where: { id: cashBalance.id },
            data: {
                totalRegistrationFee: {
                    increment: 500,
                },
                availableCash: {
                    increment: 500
                },
            },
        });
        console.log('✅ CashBalance updated with registration fee.');
    }

    // console.log('Super Admin created:', superAdmin)
}

main().catch(console.error).finally(() => prisma.$disconnect())
