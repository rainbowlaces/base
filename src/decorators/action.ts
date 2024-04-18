import BaseModule from "../core/baseModule";
import { BaseAction, BaseActionArgs } from "../core/baseAction";
import BasePubSub from "../core/basePubSub";

export default function action(topic?: string, handled: boolean = true) {
  return function (
    this: unknown,
    target: BaseAction,
    context: ClassMethodDecoratorContext,
  ): void {
    if (context.kind !== "method") return;
    const checkDeps: BaseAction = async function (
      this: BaseModule,
      args?: BaseActionArgs,
    ) {
      if (!args || !args.context) return;
      const ctx = args.context;

      if (ctx.res.finished) {
        this.logger.debug(
          `Response already finished by another action. Skipping ${target.name}.`,
        );
        return;
      }

      if (target.dependsOn) {
        this.logger.debug(
          `Awaiting deps for action ${target.name}: ${target.dependsOn.join(", ")}`,
          [ctx.id],
        );
        await ctx.waitForActions(target.dependsOn);
      }

      if (ctx.res.finished) {
        this.logger.debug(
          `Response already finished by another action. Skipping ${target.name}.`,
        );
        return;
      }

      this.logger.debug(`Handling action ${target.name}`);
      if (handled) ctx.handle();
      await target.apply(this, [{ context: ctx, ...args }]);
      this.logger.debug(`Action ${target.name}: DONE`);

      const fullTopic = `/module/${ctx.id}/${this.constructor.name}/${target.name}`;
      BasePubSub.create().pub(fullTopic);
    };
    context.addInitializer(function () {
      BasePubSub.sub(`/request${topic || "/:path*"}`, checkDeps.bind(this));
    });
  };
}
