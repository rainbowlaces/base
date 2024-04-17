import { Key, pathToRegexp } from "path-to-regexp";
import BaseConfig from "./config";
import di from "../decorators/di";

type UrlParams = Record<string, string>;
type RouteHandler = (params: UrlParams) => string;
type RouteTarget = string | RouteHandler;
type Routes = Record<string, RouteTarget>;

export default class BaseRouter {
  private routes: Routes = {};
  private defaultRoute?: string;

  @di<BaseConfig>("BaseConfig", "base_router")
  private _config!: BaseConfig;

  private cleanPath(path: string): string {
    return path
      .split("/")
      .filter((s: string) => !!s)
      .join("/");
  }

  constructor() {
    this.routes = this._config.get<Routes>("routes", {});
    this.defaultRoute = this._config.get<string>("defaultRoute", "");
  }

  private selectRoute(
    url: string,
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
      target = target(params);
    }

    return { path: route, target, params };
  }

  handleRoute(urlPath: string) {
    const cleanPath = this.cleanPath(urlPath);
    if (!cleanPath && this.defaultRoute) return this.defaultRoute;

    const route = this.selectRoute(cleanPath);
    if (!route) return cleanPath;

    return route.target;
  }
}
