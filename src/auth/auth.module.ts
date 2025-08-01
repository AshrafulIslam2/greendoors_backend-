/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { EmailModule } from 'src/email/email.module';


@Module({
  imports: [
    PrismaModule,
    EmailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }), // Register Passport with JWT as default strategy
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret', // Use environment variable in production
      signOptions: { expiresIn: '14d' }, // Optional: configure token expiration
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtModule, JwtStrategy, PassportModule],
})
export class AuthModule { }
