import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from './admin-auth.service';
import { hashPassword, verifyPassword } from './password';
import { PrismaService } from '../prisma/prisma.service';

const secret = 'test-only-admin-secret-'.repeat(3);
const jwt = new JwtService();
let storedHash: string;
beforeAll(async () => {
  storedHash = await hashPassword('Strong-test-password!');
}, 15000);
function setup(exists = true) {
  const admin = {
    id: 'admin-id',
    name: 'Admin',
    email: 'admin@example.com',
    passwordHash: storedHash,
  };
  const prisma = {
    admin: { findUnique: vi.fn().mockResolvedValue(exists ? admin : null) },
  };
  const auth = new AdminAuthService(
    prisma as unknown as PrismaService,
    jwt,
    new ConfigService({ ADMIN_JWT_SECRET: secret }),
  );
  return { auth, prisma, admin };
}
describe('admin authentication', () => {
  it('hashes with a random salt and compares securely', async () => {
    expect(storedHash).toMatch(/^\$2b\$12\$/);
    expect(await hashPassword('Strong-test-password!')).not.toBe(storedHash);
    expect(await verifyPassword('Strong-test-password!', storedHash)).toBe(
      true,
    );
    expect(await verifyPassword('wrong', storedHash)).toBe(false);
    expect(await verifyPassword('wrong', 'malformed')).toBe(false);
  }, 15000);
  it('rejects legacy hashes without a fallback', async () => {
    expect(await verifyPassword('password', 'scrypt$32768$8$3$legacy')).toBe(
      false,
    );
    expect(await verifyPassword('password')).toBe(false);
  });
  it('rejects passwords over 72 UTF-8 bytes instead of silently truncating', async () => {
    const boundary = 'a'.repeat(72);
    const boundaryHash = await hashPassword(boundary);
    expect(await verifyPassword(boundary, boundaryHash)).toBe(true);
    expect(await verifyPassword(boundary + 'b', boundaryHash)).toBe(false);
    await expect(hashPassword('é'.repeat(37))).rejects.toThrow(
      '72 UTF-8 bytes',
    );
  }, 15000);
  it('normalizes login email and never returns passwordHash', async () => {
    const { auth, prisma } = setup();
    const result = await auth.login(
      '  ADMIN@EXAMPLE.COM ',
      'Strong-test-password!',
    );
    expect(prisma.admin.findUnique).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
    });
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain(storedHash);
    const claims = await jwt.verifyAsync(result.accessToken, {
      secret,
      algorithms: ['HS256'],
      issuer: 'anka-wifi',
      audience: 'anka-admin',
    });
    expect(claims.sub).toBe('admin-id');
    expect(claims.exp - claims.iat).toBe(3600);
  });
  it.each([true, false])(
    'uses generic invalid credentials for account existence=%s',
    async (exists) => {
      const { auth } = setup(exists);
      await expect(
        auth.login('admin@example.com', 'wrong'),
      ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' });
    },
  );
  it('rejects tokens for deleted/non-admin identities', async () => {
    const { auth } = setup(false);
    const token = jwt.sign(
      {},
      {
        secret,
        subject: 'customer-id',
        issuer: 'anka-wifi',
        audience: 'anka-admin',
        expiresIn: 3600,
      },
    );
    await expect(auth.authenticate(token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it.each([
    'expired',
    'audience',
    'issuer',
    'algorithm',
    'no-expiry',
    'malformed',
  ])('rejects %s tokens', async (mode) => {
    const { auth } = setup();
    let token = 'invalid';
    if (mode !== 'malformed')
      token = jwt.sign(
        {},
        {
          secret,
          subject: 'admin-id',
          issuer: mode === 'issuer' ? 'other' : 'anka-wifi',
          audience: mode === 'audience' ? 'customer' : 'anka-admin',
          algorithm: mode === 'algorithm' ? 'HS384' : 'HS256',
          ...(mode === 'no-expiry'
            ? {}
            : { expiresIn: mode === 'expired' ? -1 : 3600 }),
        },
      );
    await expect(auth.authenticate(token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('rejects missing/weak configuration', () => {
    expect(
      () =>
        new AdminAuthService(
          {} as PrismaService,
          jwt,
          new ConfigService({ ADMIN_JWT_SECRET: 'short' }),
        ),
    ).toThrow();
  });
});
