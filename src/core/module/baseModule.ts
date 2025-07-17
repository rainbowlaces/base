import { type BaseAction, type BaseActionArgs } from "./types.js";
import { type BaseContext } from "./baseContext.js";
import { type BaseClassConfig } from "../config/types.js";
import { type BaseLogger } from "../logger/baseLogger.js";
import { BaseDi } from "../di/baseDi.js";
import { delay } from "../../utils/async.js";

export abstract class BaseModule<T extends BaseClassConfig = BaseClassConfig> {
  private static dependsOn: string[] = [];

  protected readonly logger: BaseLogger;
  protected readonly config: T;

  constructor() {
    this.logger = BaseDi.resolve<BaseLogger>("BaseLogger", this.namespace);
    this.logger.info("Loaded");
    try {
      this.config = BaseDi.resolve<T>(`Config.${this.namespace}`);
    }
    catch {
      this.config = {} as T;
    }    
  }

  public get namespace(): string {
    return this.constructor.name;
  }

  get dependsOn() {
    return (this.constructor as typeof BaseModule).dependsOn;
  }

  async setup(): Promise<void> {
    await delay();
    this.logger.info(`${this.constructor.name} setup.`);
  }

  async teardown(): Promise<void> {
    this.logger.info(`${this.constructor.name} torn down.`);
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
        [fullName]
      );
      return;
    }

    const dependencies = target.dependsOn ?? [];

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
        [fullName]
      );
      return;
    }

    this.logger.debug(`Handling action ${target.name}`);

    try {
      await target.apply(this, [args]);
      ctx.actionDone(this.constructor.name, target.name);
      this.logger.debug(`Action DONE`, [fullName]);
    } catch(e) {
      this.logger.error(`Action ERROR`, [fullName], { error: e });
      ctx.actionError(this.constructor.name, target.name);
    }
  }
}
