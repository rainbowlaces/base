/* eslint-disable @typescript-eslint/no-namespace */
import path from "path";

import express from "express";
import BaseModule, { BaseModuleClass } from "./baseModule";
import Logger from "../logger";
import DependencyManager from "../dependencyManager";

import RequestParser from "../modules/requestParser";
import Config from "../config";
import Templates from "../modules/templates";
import StaticFiles from "../modules/static";
import HttpError from "./httpError";
import Router from "../modules/router";
import { ConfigObject } from "../config/types";
import { getDirname } from "../utils/file";
import BaseResponse from "./baseResponse";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      response: BaseResponse;
    }
  }
}

/**
 * Initializes and manages the core functionality of the application. It sets up the express application,
 * registers core and user-defined modules, and handles global error and 404 middlewares. It also manages
 * application configurations and the root paths for the filesystem and library.
 */
export default class Base {
  private _modules: Record<string, BaseModule> = {};
  private _userModules: BaseModuleClass[] = [];
  private _fsRoot: string;
  private _libRoot: string;

  private _baseConfig!: ConfigObject;
  private _config!: Config;
  logger!: Logger;
  app!: express.Application;

  /**
   * Constructs the Base class, initializing the Express application, configurations, and setting up the
   * filesystem and library root directories. It also triggers the initial loading of core and user modules.
   *
   * @param {string} fsRoot The root directory for the filesystem, used to determine paths for configurations and modules.
   */
  constructor(fsRoot: string) {
    this._fsRoot = fsRoot;
    this._libRoot = getDirname(import.meta.url);
  }

  get baseConfig(): ConfigObject {
    return this._baseConfig;
  }

  /**
   * Retrieves the filesystem root path.
   *
   * @returns {string} The filesystem root path used by the application.
   */
  get fsRoot(): string {
    return this._fsRoot;
  }

  /**
   * Retrieves the library root path.
   *
   * @returns {string} The library root path, typically the directory where the Base class is located.
   */
  get libRoot(): string {
    return this._libRoot;
  }

  /**
   * Initializes the application by loading core modules (Router, RequestParser, StaticFiles, Templates),
   * user-defined modules, and setting up global error handling and 404 response middleware. This method
   * is called during construction to prepare the application for incoming HTTP requests.
   */
  async init() {
    this.app = express();
    this._config = new Config(
      path.join(this._fsRoot, "config"),
      process.env.NODE_ENV,
    );
    await this._config.init();

    this._baseConfig = this._config.getNamespace("base");
    Logger.init(this._config.getNamespace("logger"));

    this.logger = new Logger("base");

    process.on("uncaughtException", (err) => {
      this.logger.fatal("Uncaught Exception", [], { err });
    });

    process.on("unhandledRejection", (reason, promise) => {
      this.logger.fatal("Unhandled Rejection", [], { promise, reason });
    });

    this.app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        req.id = Math.random().toString(36).substring(7);
        req.response = new BaseResponse(res);
        next();
      },
    );

    this.logger.info(`Load Core Modules...`);
    await this.registerModule(Router);
    await this.registerModules([RequestParser, StaticFiles, Templates]);
    this.logger.info(`Loaded Core Modules.`);

    this.logger.info(`Load User Modules...`);
    await this.registerModules(this._userModules);
    this.logger.info(`Loaded User Modules.`);

    this.app.use(
      (
        err: HttpError | Error,
        req: express.Request,
        res: express.Response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        next: express.NextFunction,
      ): void => {
        if (err instanceof HttpError) {
          this.logger.error(
            err.message,
            ["http", ...(req.id ? [req.id] : [])],
            {
              error: err.wrapped,
            },
          );
          if (res.headersSent) return;
          res.status(err.statusCode).send(err.message);
          return;
        }
        this.logger.error(
          err.message,
          [err.constructor.name, ...(req.id ? [req.id] : [])],
          {
            error: err.stack?.split("\n"),
          },
        );
        if (!res.headersSent) res.status(500).send("Internal Server Error");
        return;
      },
    );

    this.app.use((req: express.Request, res: express.Response) => {
      this.logger.warn(`404: ${req.url}`, [...(req.id ? [req.id] : [])]);
      if (res.headersSent) return;
      res.status(404).send("Not Found");
    });

    // execute any post init handlers for modules
    Object.values(this._modules).forEach(
      async (module) => await module.postInit(),
    );
  }

  /**
   * Retrieves a configuration namespace, allowing access to specific sections of the application configuration.
   *
   * @param {string} namespace The configuration namespace to retrieve.
   * @returns {any} The configuration object for the specified namespace.
   */
  getConfig(namespace: string): ConfigObject {
    return this._config.getNamespace(namespace);
  }

  /**
   * Retrieves a module by its name.
   * @param name - The name of the module to retrieve.
   * @returns The module with the specified name.
   */
  getModule<T>(name: string): T {
    return this._modules[name] as T;
  }

  addUserModule(Module: BaseModuleClass) {
    this._userModules.push(Module);
  }

  /**
   * Registers an array of module classes with the application. Each module class is instantiated and
   * initialized, allowing it to register its routes, middleware, or any other initialization logic.
   *
   * @param {Array<new (base: Base) => BaseModule>} modules An array of module classes to register.
   */
  async registerModules(modules: Array<new (base: Base) => BaseModule>) {
    for (const Module of new DependencyManager(modules)) {
      await this.registerModule(Module);
    }
  }

  /**
   * Registers a single module class with the application. The module is instantiated and initialized,
   * similar to registerModules, but for a single module class. This method is used internally by
   * registerModules for each module in the provided array.
   *
   * @param {new (base: Base) => BaseModule} ModuleClass The module class to register.
   */
  async registerModule(ModuleClass: new (base: Base) => BaseModule) {
    const moduleName = ModuleClass.name;

    this.logger.info(`Registering module: ${moduleName}...`);

    if (this._modules[moduleName]) {
      throw new Error(
        `Looks like this module (${moduleName}) has already registered.`,
      );
    }

    const m = new ModuleClass(this);
    await m.init();

    for (const middleware of m.middleware()) {
      const mw = middleware;
      const mwName = mw.name.replace("bound ", "");
      const wrappedMiddleware = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        if (mw.httpMethod && mw.httpMethod !== req.method.toLowerCase()) {
          return next();
        }

        const params = mw.pathMatcher ? mw.pathMatcher(req.path) : null;
        if (mw.path && mw.pathMatcher && !params) {
          return next();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.params = (params && (params as any).params) || {};

        this.logger.debug(
          `Running middleware: ${moduleName}:${mwName} ${req.method.toLowerCase()}`,
          [moduleName, mwName, ...(req.id ? [req.id] : [])],
        );

        try {
          await mw(req, req.response, next);
        } catch (err) {
          next(err);
        }
      };

      // if (mw.path) {
      //   this.app.use(mw.path, wrappedMiddleware);
      // } else {
      this.app.use(wrappedMiddleware);
      //}

      this.logger.info(
        `Registered middleware: ${moduleName}:${mwName} ${mw.httpMethod?.toUpperCase() || ""} ${mw.path || ""}`,
      );
    }

    this._modules[moduleName] = m;

    this.logger.info(`Registered module: ${moduleName}.`);
  }

  /**
   * Starts listening for HTTP requests on a specified port. This method is typically called after all
   * modules and middleware have been registered, signaling that the application is ready to handle requests.
   */
  async go() {
    const PORT = process.env.PORT || this._baseConfig.port || 8080;

    this.app.listen(PORT, () => {
      this.logger.info(`Base listening for HTTP requests on ${PORT}.`);
    });
  }
}
