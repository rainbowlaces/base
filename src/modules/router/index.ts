import { Key, pathToRegexp } from "path-to-regexp";

import { Request, NextFunction } from "express";
import BaseModule from "../../core/baseModule";
import middleware from "../../decorators/middleware";
import config from "../../decorators/config";
import BaseResponse from "../../core/baseResponse";

type UrlParams = Record<string, string>;
type RouteHandler = (params: UrlParams, req: Request) => string;
type RouteTarget = string | RouteHandler;

/**
 * Handles routing for the application by registering routes and their corresponding handlers. It supports
 * dynamic route matching and allows for the configuration of default and custom routes, enhancing the
 * application's flexibility in handling HTTP requests.
 */
export default class Router extends BaseModule {
  @config()
  routes: Record<string, RouteTarget> = {};

  @config()
  defaultRoute: string = "";

  async init() {
    this.logger.log("Router initialized");
  }

  private cleanPath(path: string): string {
    return path
      .split("/")
      .filter((s: string) => !!s)
      .join("/");
  }

  private selectRoute(
    url: string,
    req: Request,
  ): { path: string; target: string; params: UrlParams } | null {
    url = `/${url}`;
    const routes = Object.keys(this.routes);
    const route = routes.find((route) => {
      const re = pathToRegexp(route);
      return re.test(url);
    });
    if (!route) return null;

    const paramMap: Key[] = [];
    const re = pathToRegexp(route, paramMap);
    const match = re.exec(url);
    if (!match) return null;

    const params: UrlParams = {};
    paramMap.forEach((param: Key, index: number) => {
      params[param.name] = match[index + 1];
    });

    let target: RouteTarget = this.routes[route];
    if (typeof target === "function") {
      target = target(params, req);
    }

    return { path: route, target: String(target), params };
  }

  @middleware
  async handleRoutes(req: Request, res: BaseResponse, next: NextFunction) {
    const cleanPath = this.cleanPath(req.path);
    if (!cleanPath && this.defaultRoute) {
      req.url = this.defaultRoute;
      return next();
    }

    const route = this.selectRoute(cleanPath, req);
    if (!route) return next();

    req.url = route.target as string;

    const url = new URL(req.url, "http://example.com");
    req.query = Object.fromEntries(url.searchParams.entries());
    req.params = route.params;
    next();
  }
}
