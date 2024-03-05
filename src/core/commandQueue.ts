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

  private done() {
    this._module.logger.debug(`Command queue done.`);
    this._done = true;
  }

  async run(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    for (const command of this.commands) {
      try {
        this._module.logger.debug(`Running command ${command.name}`);
        await command(req, res, () => this.done());
        this._module.logger.debug(`Command ${command.name} done.`);
        if (this._done || res.headersSent) return;
      } catch (error) {
        next(error);
        return;
      }
    }
  }
}
