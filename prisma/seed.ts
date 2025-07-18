/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'; // ✅



const prisma = new PrismaClient()

async function main() {
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

    console.log('Super Admin created:', superAdmin)
}

main().catch(console.error).finally(() => prisma.$disconnect())
