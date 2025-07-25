/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from 'src/prisma/prisma.module'; // Import PrismaModule for PrismaService
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule], // Import PrismaModule to provide PrismaService
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule { }