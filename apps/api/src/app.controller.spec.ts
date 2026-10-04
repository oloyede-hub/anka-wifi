import { AppController } from './app.controller';
describe('AppController', () => {
  it('returns liveness status', () => {
    expect(new AppController().getHealth()).toEqual({ status: 'ok' });
  });
});
