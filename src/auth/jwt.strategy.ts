/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
interface JwtPayload {
    id: number;
    email: string;
    role: string;
    memberId: number;
}
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_SECRET || 'secret', // use env in prod
        });
    }

    validate(payload: JwtPayload): { id: number; email: string; role: string, memberId: number } {
        return {
            id: payload.id,
            email: payload.email,
            role: payload.role,
            memberId: payload.memberId,
        };
    }
}