/* eslint-disable prettier/prettier */
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }
    @Post('login')
    login(@Body() body: { email: string, password: string }) {
        return this.authService.login(body.email, body.password)
    }
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: { email: string }) {
        return this.authService.forgotPassword(dto);
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: { token: string, password: string }) {
        return this.authService.resetPassword(dto);
    }

    // // Optional: Endpoint to check first-time login (e.g., after login)
    // @Post('check-first-login')
    // @HttpCode(HttpStatus.OK)
    // async checkFirstLogin(@Body('userId') userId: number) {
    //     return this.authService.checkFirstLogin(userId);
    // }
}
