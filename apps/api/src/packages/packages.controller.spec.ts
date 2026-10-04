import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
describe('PackagesController', () => {
  it('propagates failures to Nest instead of returning an HTTP 200 error body', async () => {
    const failure = new Error('database unavailable');
    const service = { findAll: vi.fn().mockRejectedValue(failure) };
    const controller = new PackagesController(
      service as unknown as PackagesService,
    );
    await expect(controller.findAll()).rejects.toThrow(failure);
  });
});
