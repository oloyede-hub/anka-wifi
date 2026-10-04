import { compare, hash, truncates } from 'bcryptjs';

const rounds = 12;
// Unknown and malformed accounts still incur bcrypt comparison work.
const dummyHash = '$2b$12$' + '.'.repeat(53);

export async function hashPassword(password: string): Promise<string> {
  if (truncates(password))
    throw new Error('Password must not exceed 72 UTF-8 bytes');
  return hash(password, rounds);
}

export async function verifyPassword(
  password: string,
  stored?: string,
): Promise<boolean> {
  const valid =
    typeof stored === 'string' &&
    /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(stored);
  const tooLong = truncates(password);
  const matched = await compare(
    tooLong ? 'invalid-overlong-password' : password,
    valid ? stored : dummyHash,
  );
  return valid && !tooLong && matched;
}
