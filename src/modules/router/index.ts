import { Key, pathToRegexp } from "path-to-regexp";

import BaseModule from "../../core/baseModule";
import init from "../../decorators/init";
import { BaseActionArgs } from "../../core/baseAction";
import action from "../../decorators/action";
import BaseRequest from "../../core/baseRequest";
import config from "../../decorators/config";

type UrlParams = Record<string, string>;
type RouteHandler = (params: UrlParams, req: BaseRequest) => string;
type RouteTarget = string | RouteHandler;
type Routes = Record<string, RouteTarget>;

export default class BaseRouter extends BaseModule {
  @config<Routes>()
  private routes: Routes = {};

  @config<string>()
  private defaultRoute: string = "/";

  @init()
  async init() {}

  private cleanPath(path: string): string {
    return path
      .split("/")
      .filter((s: string) => !!s)
      .join("/");
  }

  private selectRoute(
    url: string,
    req: BaseRequest,
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

    return { path: route, target, params };
  }

  @action(undefined, false)
  async handleRoutes(args?: BaseActionArgs) {
    if (!args || !args.context) return;
    const ctx = args.context;
    const cleanPath = this.cleanPath(ctx.req.url.pathname);
    if (!cleanPath && this.defaultRoute) {
      ctx.res.redirect(this.defaultRoute);
      return;
    }

    const route = this.selectRoute(cleanPath, ctx.req);
    if (!route) return;

    ctx.res.redirect(route.target);
  }
}
