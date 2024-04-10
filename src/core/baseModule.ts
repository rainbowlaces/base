import Logger from "../logger";
import { camelToLowerUnderscore } from "../utils/string";
import Base from "./base";
import DependencyManager from "../dependencyManager";
import { BaseRequestHandler } from "./baseRequestHandler";
import { ConfigObject } from "../config/types";
import CommandQueue, { Command } from "./commandQueue";

type InitializationFunction = (this: BaseModule) => BaseRequestHandler;

export type BaseModuleClass = new (base: Base) => BaseModule;

/**
 * Abstract base class for all modules within the application. It provides essential properties and methods
 * that every module can inherit, such as access to the base application instance, configuration, logging, and
 * middleware management. Modules extending this class must implement their own initialization logic.
 */
export default abstract class BaseModule {
  private _namespace: string;
  private _logger: Logger;
  private _base: Base;
  private _config: ConfigObject;

  private _middleware?: DependencyManager<BaseRequestHandler>;
  private _commands: Map<string, DependencyManager<Command>> = new Map();

  /**
   * Constructs a BaseModule instance, initializing the module with
   * a reference to the base application, its namespace, and its configuration.
   * @param base The base application instance, providing access to global configurations and utilities.
   */
  constructor(base: Base) {
    this._base = base;
    this._namespace = camelToLowerUnderscore(this.constructor.name);
    this._logger = new Logger(this._namespace);
    this._config = this._base.getConfig(this._namespace);
    this._logger.log(`Initialised ${this.constructor.name} module.`);
  }

  /**
   * Retrieves the logger instance for the module, allowing for namespaced logging.
   * @returns {Logger} The logger instance for the module.
   */
  get logger() {
    return this._logger;
  }

  /**
   * Provides access to the base application instance, enabling module interaction with the broader application context.
   * @returns {Base} The base application instance.
   */
  get base() {
    return this._base;
  }

  /**
   * Retrieves the configuration object for the module, sourced from the application's global configuration.
   * @returns {Object} The configuration object for the module.
   */
  get config() {
    return this._config;
  }

  /**
   * Returns the namespace of the module, typically derived from the class name converted to lower underscore case.
   * @returns {string} The namespace of the module.
   */
  get namespace() {
    return this._namespace;
  }

  // setters
  set config(val) {
    throw new Error("Don't override the config you muppet! 🐸");
  }
  set base(val) {
    throw new Error("Don't override the base object you muppet! 🐸");
  }
  set logger(val) {
    throw new Error("Don't override the logger you muppet! 🐸");
  }
  set namespace(val) {
    throw new Error("Don't override the namespace you muppet! 🐸");
  }

  /**
   * Initializes the module. This method should be overridden by subclasses to perform module-specific initialization tasks.
   */
  async init() {}
  async postInit() {}

  // eslint-disable-next-line @typescript-eslint/ban-types
  private _bindMethodWithProps<T extends Function>(
    method: T,
    props: Partial<T>,
  ): T {
    // Assume T can have properties, hence the extension
    type MethodProps = keyof T;

    (Object.keys(props) as Array<MethodProps>).forEach((prop) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (method as any)[prop] = (props as any)[prop];
    });

    return method;
  }

  middleware(): DependencyManager<BaseRequestHandler> {
    if (this._middleware) return this._middleware;
    const middleware = new DependencyManager<BaseRequestHandler>(
      this.getMethods<BaseRequestHandler>(
        (method: BaseRequestHandler) => !!method.isMiddleware,
      ).map((method: BaseRequestHandler) => {
        let boundMethod;
        if (method.isInit) {
          boundMethod = (method as unknown as InitializationFunction)
            .apply(this)
            .bind(this);
        } else {
          boundMethod = method.bind(this);
        }
        return this._bindMethodWithProps<BaseRequestHandler>(
          boundMethod,
          method,
        );
      }),
    );
    this._middleware = middleware;
    return middleware;
  }

  commands(queue: string): CommandQueue {
    let methods: DependencyManager<Command>;
    if (this._commands.has(queue)) {
      methods = this._commands.get(queue) || new DependencyManager<Command>();
    } else {
      methods = new DependencyManager<Command>(
        this.getMethods<Command>(
          (method: Command) =>
            !!method.isCommand && (method.queue ?? []).includes(queue),
        ).map((method: Command) => {
          const boundMethod = method.bind(this);
          return this._bindMethodWithProps<Command>(boundMethod, method);
        }),
      );
      this._commands.set(queue, methods);
    }

    return new CommandQueue(this, methods);
  }

  private getMethods<T>(filter: (method: T) => boolean = () => true): T[] {
    const methods: T[] = [];
    let proto = Object.getPrototypeOf(this);

    while (proto && proto !== Object.prototype) {
      Object.getOwnPropertyNames(proto).forEach((prop) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const property = (this as any)[prop];
        if (
          typeof property === "function" &&
          prop !== "constructor" &&
          prop !== "getMethods"
        ) {
          if (filter(property)) {
            methods.push(property);
          }
        }
      });

      proto = Object.getPrototypeOf(proto);
    }

    return methods;
  }
}
