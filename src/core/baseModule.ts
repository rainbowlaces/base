// import { BaseLogger } from "./logger/baseLogger";
import { type BaseAction, type BaseActionArgs } from "./baseAction";
import { type BaseContext } from "./baseContext";
// import { BaseDi } from "./di/baseDi";

export abstract class BaseModule {
  private static dependsOn: string[] = [];

  // eslint-disable-next-line @typescript-eslint/naming-convention
  // private _logger!: BaseLogger;
  // protected readonly config: T;

  // constructor(config: T) {
  //   const logger = BaseDi.create().resolve<BaseLogger>(
  //     BaseLogger,
  //     this.namespace
  //   );
  //   if (!logger)
  //     throw new Error(`Logger not found for module! ${this.namespace}`);
  //   this._logger = logger;
  //   this._logger.info("Loaded");
  //   this.config = config;
  // }

  // protected get logger() {
  //   return this._logger;
  // }

  public get namespace(): string {
    return this.constructor.name;
  }

  get dependsOn() {
    return (this.constructor as typeof BaseModule).dependsOn;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isAction(action: any): action is BaseAction {
    if (typeof action !== "function") return false;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!(action as BaseAction).action) return false;
    return true;
  }

  getAction(name: string): BaseAction | undefined {
    const action = this[name as keyof this];
    return this.isAction(action) ? action : undefined;
  }

  private contextIsDoneOrError(ctx: BaseContext) {
    return ctx.state === "done" || ctx.state === "error";
  }

  public async executeAction(action: string, args: BaseActionArgs) {
    const fullName = `${this.constructor.name}/${action}`;

    const target = this.getAction(action);
    if (!target) {
      this.logger.error(`Action not found: ${fullName}`);
      return;
    }

    const ctx = args.context;

    if (this.contextIsDoneOrError(ctx)) {
      this.logger.warn(
        `Context state: ${ctx.state}. Skipping ${target.name}.`,
        [fullName]
      );
      return;
    }

    // For now, use only explicit dependencies (no global action injection)
    const dependencies = target.dependsOn ?? [];

    // this.logger.debug(`Deps for action: ${dependencies.join(", ")}`, [
    //   ctx.id,
    //   fullName,
    // ]);

    if (dependencies.length) {
      await ctx.waitFor(dependencies);
    }

    // this.logger.debug(`All deps. complete.`, [ctx.id, fullName]);

    if (this.contextIsDoneOrError(ctx)) {
      // this.logger.warn(
      //   `Context state: ${ctx.state}. Skipping ${target.name}.`,
      //   [fullName]
      // );
      return;
    }

    // this.logger.debug(`Handling action ${target.name}`);

    try {
      await target.apply(this, [args]);
      ctx.actionDone(this.constructor.name, target.name);
      // this.logger.debug(`Action DONE`, [fullName]);
    } catch  {
      // this.logger.error(`Action ERROR`, [fullName], { error: e });
      ctx.actionError(this.constructor.name, target.name);
    }
  }
}
