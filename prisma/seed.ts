import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'; // ✅



const prisma = new PrismaClient()

async function main() {
    const existingCashBalance = await prisma.cashBalance.findFirst()
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
            },
        });
        console.log('✅ CashBalance record created.');
    } else {
        console.log('ℹ️ CashBalance already exists.');
    }
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
                    memberId: '1901',
                    type: 'Founder',
                    joiningDate: new Date('2019-10-01'),
                    registrationFeeInfo: {
                        create: {
                            amount: 500
                        }
                    }

                }
            }
        },
    })
    await this.prisma.cashBalance.update({
        where: { id: cashBalance.id }, // or however you identify your singleton CashBalance row
        data: {
            totalDeposit: {
                increment: 500,
            },
            availableCash: {
                increment: 500
            },
        },
    });

    console.log('Super Admin created:', superAdmin)
}

main().catch(console.error).finally(() => prisma.$disconnect())
