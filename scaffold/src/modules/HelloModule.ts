import { BaseModule, request } from '@rainbowlaces/base';

export class HelloModule extends BaseModule {
  @request('/get/hello')
  async hello({ context }) {
    context.res.json({ message: 'Hello World' });
  }
}
