import { BaseModule, request, baseModule } from '@rainbowlaces/base';

@baseModule()
export class HelloModule extends BaseModule {
  @request('/get/hello')
  async hello({ context }) {
    context.res.json({ message: 'Hello World' });
  }
}
