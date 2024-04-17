import BaseModule from "../core/baseModule";
import BasePubSub from "../core/basePubSub";
import BaseDi from "../core/baseDi";

export default function init() {
  return (
    target: () => Promise<void>,
    context: ClassMethodDecoratorContext,
  ): void => {
    if (context.kind !== "method") return;
    context.addInitializer(function () {
      BasePubSub.sub(
        "/base/init",
        async function (this: BaseModule) {
          await this.deps.isReady();
          await target.apply(this);
          BaseDi.register(this);
          this.deps.done(this.constructor.name);
          this.logger.info(`Module ${this.constructor.name} initialized`);
        }.bind(this as BaseModule),
      );
    });
  };
}
