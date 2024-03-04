import express from "express";
import DependencyManager from "../dependencyManager";

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

  constructor(commands: DependencyManager<Command>) {
    this.commands = commands;
  }

  private done() {
    this._done = true;
  }

  async run(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): Promise<void> {
    for (const command of this.commands) {
      try {
        await command(req, res, () => this.done());
        if (this._done || res.headersSent) return;
      } catch (error) {
        next(error);
        return;
      }
    }
  }
}
