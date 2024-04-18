import BaseModule from "../core/baseModule";
import { BaseAction, BaseActionArgs } from "../core/baseAction";
import BasePubSub from "../core/basePubSub";
import BaseDi from "../core/baseDi";

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

      const di = new BaseDi();
      const globalActions =
        di.resolve<Set<string>>("globalActions") || new Set();
      let dependencies = [];
      if (!target.isGlobal) {
        dependencies = [
          ...(target.dependsOn || []),
          ...Array.from(globalActions),
        ];
      } else {
        dependencies = [
          ...(target.dependsOn || []).filter((dep) => globalActions.has(dep)),
        ];
      }

      this.logger.debug(
        `Deps for action ${target.name}: ${dependencies.join(", ")}`,
        [ctx.id],
      );

      if (dependencies.length) {
        await ctx.waitForActions(dependencies);
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
