import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './password';

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
}
export const adminSelect = { id: true, email: true, name: true } as const;

@Injectable()
export class AdminAuthService {
  private readonly secret: string;
  private readonly expiresIn: number;
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('ADMIN_JWT_SECRET');
    if (
      !secret ||
      Buffer.byteLength(secret) < 32 ||
      /replace|change.?me/i.test(secret)
    )
      throw new Error(
        'ADMIN_JWT_SECRET must contain at least 32 bytes of a strong secret',
      );
    this.secret = secret;
    const expiry = config.get<string>('ADMIN_JWT_EXPIRES_IN') ?? '1h';
    const match = /^(\d+)(s|m|h)?$/.exec(expiry);
    const seconds = match
      ? Number(match[1]) * (match[2] === 'h' ? 3600 : match[2] === 'm' ? 60 : 1)
      : 0;
    if (!Number.isSafeInteger(seconds) || seconds < 300 || seconds > 86400)
      throw new Error(
        'ADMIN_JWT_EXPIRES_IN must be between 5 minutes and 24 hours',
      );
    this.expiresIn = seconds;
  }
  async login(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const valid = await verifyPassword(password, admin?.passwordHash);
    if (!admin || !valid)
      throw new UnauthorizedException('Invalid credentials');
    const accessToken = await this.jwt.signAsync(
      {},
      {
        secret: this.secret,
        algorithm: 'HS256',
        issuer: 'anka-wifi',
        audience: 'anka-admin',
        subject: admin.id,
        expiresIn: this.expiresIn,
      },
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expiresIn,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }
  async authenticate(token: string): Promise<AdminIdentity> {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.secret,
        algorithms: ['HS256'],
        issuer: 'anka-wifi',
        audience: 'anka-admin',
      });
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('sub' in payload) ||
      typeof payload.sub !== 'string' ||
      !('exp' in payload) ||
      typeof payload.exp !== 'number'
    )
      throw new UnauthorizedException('Invalid admin token');
    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
      select: adminSelect,
    });
    if (!admin) throw new UnauthorizedException('Invalid admin token');
    return admin;
  }
}
