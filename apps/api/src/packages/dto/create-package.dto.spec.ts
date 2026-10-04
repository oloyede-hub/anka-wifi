import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePackageDto } from './create-package.dto';
import { UpdatePackageDto } from './update-package.dto';
describe('Package DTO validation', () => {
  it.each([0, -1, 0.001, 100000000, NaN, Infinity])(
    'rejects invalid price %s',
    async (price) => {
      const dto = plainToInstance(CreatePackageDto, {
        name: 'Daily',
        type: 'DAILY',
        price,
      });
      expect(
        (await validate(dto)).some((error) => error.property === 'price'),
      ).toBe(true);
    },
  );
  it('rejects null PATCH fields while accepting omissions', async () => {
    expect(await validate(plainToInstance(UpdatePackageDto, {}))).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(UpdatePackageDto, {
            price: null,
            name: null,
            status: null,
          }),
        )
      ).length,
    ).toBe(3);
  });
});
