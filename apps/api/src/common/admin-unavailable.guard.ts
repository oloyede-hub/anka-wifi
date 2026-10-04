import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

// Fail closed until real admin authentication and authorization are implemented.
@Injectable()
export class AdminUnavailableGuard implements CanActivate {
  canActivate(): never {
    throw new ServiceUnavailableException(
      'Admin endpoints are unavailable until admin authentication is implemented',
    );
  }
}
