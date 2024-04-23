import BaseLogger from "./logger";
import { camelToLowerUnderscore } from "../utils/string";
import BaseConfig from "./config";
import BasePubSub from "./basePubSub";
import di from "../decorators/di";
import { BaseAction, BaseActionArgs } from "./baseAction";
import BaseDi from "./baseDi";
import BaseContext from "./baseContext";

export default abstract class BaseModule {
  private _namespace: string;

  private static dependsOn: string[] = [];

  @di<BasePubSub>("BasePubSub")
  private _bus!: BasePubSub;

  private _logger: BaseLogger;
  private _config: BaseConfig;

  constructor() {
    this._namespace = camelToLowerUnderscore(this.constructor.name);
    this._logger = new BaseLogger(this._namespace);
    this._config = new BaseConfig(this._namespace);

    this._logger.info("Loaded");

    if (!this.dependsOn.length) return;
  }

  protected get logger() {
    return this._logger;
  }

  protected get config() {
    return this._config;
  }

  protected get namespace() {
    return this._namespace;
  }

  get dependsOn() {
    return (this.constructor as typeof BaseModule).dependsOn;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private isAction(action: any): action is BaseAction {
    if (typeof action !== "function") return false;
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
        [fullName],
      );
      return;
    }

    const globalActions =
      BaseDi.create().resolve<Set<string>>(`${target.type}/globalActions`) ||
      new Set();
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

    this.logger.debug(`Deps for action: ${dependencies.join(", ")}`, [
      ctx.id,
      fullName,
    ]);

    if (dependencies.length) {
      await ctx.waitFor(dependencies);
    }

    this.logger.debug(`All deps. complete.`, [ctx.id, fullName]);

    if (this.contextIsDoneOrError(ctx)) {
      this.logger.warn(
        `Context state: ${ctx.state}. Skipping ${target.name}.`,
        [fullName],
      );
      return;
    }

    this.logger.debug(`Handling action ${target.name}`);

    try {
      if (target.handler) ctx.handle();
      await target.apply(this, [args]);
      ctx.actionDone(this.constructor.name, target.name);
      this.logger.debug(`Action DONE`, [fullName]);
    } catch (e) {
      this.logger.error(`Action ERROR`, [fullName], { error: e });
      ctx.actionError(this.constructor.name, target.name);
    }
  }
}
