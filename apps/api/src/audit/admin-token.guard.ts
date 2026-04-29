import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../env';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const headerVal = req.headers['x-admin-token'];
    const token = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing admin token');
    }

    const provided = Buffer.from(token);
    const expected = Buffer.from(env.ADMIN_TOKEN);

    if (provided.length !== expected.length) {
      throw new UnauthorizedException('Invalid admin token');
    }

    if (!timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }
}
