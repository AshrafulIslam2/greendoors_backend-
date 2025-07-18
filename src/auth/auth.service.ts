/* eslint-disable prettier/prettier */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service'; // Import PrismaService
import { compare } from 'bcryptjs';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService, // Use PrismaService instead of PrismaClient
    ) {
        console.log('bcrypt compare function:', compare); // Debug log to verify bcryptjs import
    }

    async validUser(email: string, password: string) {
        console.log('email:', email);
        const user = await this.prisma.user.findUnique({ where: { email }, include: { member: true }, });
        if (!user || !(await compare(password, user.password))) {
            // Throw error if user not found or password doesn't match
            throw new UnauthorizedException('Invalid credentials');
        }
        return user;
    }

    async login(email: string, password: string) {
        console.log(email)
        const user = await this.validUser(email, password);
        const payload = { id: user.id, email: user.email, role: user.role, memberId: user.member?.memberId, };
        const token = this.jwtService.sign(payload);
        return {
            accessToken: token, // Fixed typo: accessToke → accessToken
            user: { id: user.id, email: user.email, role: user.role, name: user.name, userPersonalInfo: user.userPersonalInfoId, nomineeId: user.nomineeId, memberId: user.member?.memberId },
        };
    }
}