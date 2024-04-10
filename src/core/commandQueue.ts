import express from "express";
import DependencyManager from "../dependencyManager";
import BaseModule from "./baseModule";

export interface Command {
  (
    req: express.Request,
    res: express.Response,
    done: () => void,
  ): Promise<void>;
  queue?: string[];
  isCommand?: boolean;
}

export default class CommandQueue {
  private commands: DependencyManager<Command>;
  private _done: boolean = false;
  private _module: BaseModule;

  constructor(module: BaseModule, commands: DependencyManager<Command>) {
    this.commands = commands;
    this._module = module;
  }

  private done(req: express.Request) {
    this._module.logger.debug(`Command queue done.`, [
      ...(req.id ? [req.id] : []),
    ]);
    this._done = true;
  }

  async run(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    this._done = false;
    for (const command of this.commands) {
      try {
        this._module.logger.debug(`Running command ${command.name}`, [
          ...(req.id ? [req.id] : []),
        ]);
        await command(req, res, () => this.done(req));
        this._module.logger.debug(`Command ${command.name} done.`, [
          ...(req.id ? [req.id] : []),
        ]);
        if (this._done || res.headersSent) return next();
      } catch (error) {
        next(error);
        return;
      }
    }
  }
}
