import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService, AdminIdentity } from './admin-auth.service';
export type AdminRequest = Request & { admin?: AdminIdentity };
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' &&
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
    if (!match || match[1].length > 4096)
      throw new UnauthorizedException('Admin authentication required');
    request.admin = await this.auth.authenticate(match[1]);
    return true;
  }
}
