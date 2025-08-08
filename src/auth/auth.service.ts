/* eslint-disable prettier/prettier */
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service'; // Import PrismaService
import { compare, } from 'bcryptjs';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
    constructor(
        private jwtService: JwtService,
        private prisma: PrismaService,
        private emailService: EmailService, // Use PrismaService instead of PrismaClient
    ) {
        console.log('bcrypt compare function:', compare); // Debug log to verify bcryptjs import
    }

    async validUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email }, include: { member: true, personalInfo: true }, });
        if (!user || !(await compare(password, user.password)) || user.isDeleted || !user.isActive) {
            // Throw error if user not found or password doesn't match
            throw new UnauthorizedException('Invalid credentials');
        }
        return user;
    }

    async login(email: string, password: string) {
        console.log(email, password)
        const user = await this.validUser(email, password);
        console.log("🚀 ~ AuthService ~ login ~ user:", user)
        const payload = { id: user.id, email: user.email, role: user.role, memberId: user.member?.memberId };
        console.log("payload", payload)
        const token = this.jwtService.sign(payload);
        console.log("token", token)
        return {
            accessToken: token, // Fixed typo: accessToke → accessToken
            user: { id: user.id, email: user.email, role: user.role, profileImage: user.personalInfo?.ProfileImage || null, name: user.name, userPersonalInfo: user.userPersonalInfoId, nomineeId: user.nomineeId, memberId: user.member?.memberId },
        };
    }
    async forgotPassword(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user || !user.isActive || user.isDeleted) {
            throw new NotFoundException('User not found or inactive');
        }

        // Generate a unique token
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

        // Store token in the database
        await this.prisma.passwordResetToken.create({
            data: {
                token,
                userId: user.id,
                expiresAt,
            },
        });

        // Send reset email
        await this.emailService.sendPasswordResetEmail(user.email, token, `http://localhost:3001/reset-password`);
        return { message: 'Password reset email sent' };
    }

    async resetPassword(dto: { token: string, password: string }) {
        console.log("🚀 ~ AuthService ~ resetPassword ~ password:", dto.password)
        console.log("🚀 ~ AuthService ~ resetPassword ~ token:", dto.token)
        const resetToken = await this.prisma.passwordResetToken.findUnique({
            where: { token: dto.token },
            include: { user: true },
        });
        console.log("🚀 ~ AuthService ~ resetPassword ~ resetToken:", resetToken)

        if (
            !resetToken ||
            resetToken.used ||
            resetToken.expiresAt < new Date() ||
            !resetToken.user.isActive ||
            resetToken.user.isDeleted
        ) {
            throw new BadRequestException('Invalid or expired token');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(dto.password, 10);

        // Update user password and set isFirstLogin to false
        await this.prisma.user.update({
            where: { id: resetToken.userId },
            data: {
                password: hashedPassword,
                isFirstLogin: false,
            },
        });

        // Mark token as used
        await this.prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true },
        });

        return { message: 'Password reset successfully' };
    }
}