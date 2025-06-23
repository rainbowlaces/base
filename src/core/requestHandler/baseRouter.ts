import { BaseConfig } from "../config";
import { di } from "../../decorators/di";

type UrlParams = Record<string, string>;
type RouteHandler = (params: UrlParams) => string;
type RouteTarget = string | RouteHandler;
type Routes = Record<string, RouteTarget>;

export class BaseRouter {
  private routes: Routes = {};
  private defaultRoute?: string;

  @di<BaseConfig>("BaseConfig", "base_router")
  private accessor _config!: BaseConfig;

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

  private static createURLPattern(route: string): URLPattern {
    try {
      return new URLPattern({ pathname: route });
    } catch (err) {
      throw new Error(`Invalid route pattern: ${route}. ${err}`);
    }
  }

  private selectRoute(
    url: string,
  ): { path: string; target: string; params: UrlParams } | null {
    url = `/${url}`;
    const routes = Object.keys(this.routes);
    const route = routes.find((route) => {
      const pattern =  BaseRouter.createURLPattern(route);
      return !!pattern.exec({ pathname: url });
    });
    if (!route) return null;

    const pattern =  BaseRouter.createURLPattern(route);
    const match = pattern.exec({ pathname: url });
    if (!match) return null;

    const params: UrlParams = Object.fromEntries(
      Object.entries(match.pathname.groups || {}).filter(([_, value]) => value !== undefined)
    ) as UrlParams;

    let target: RouteTarget = this.routes[route];
    if (typeof target === "function") {
      target = target(params);
    }

    return { path: route, target, params };
  }

  handleRoute(urlPath: string): {
    original: string;
    target: string;
    rewrite: boolean;
  } {
    const cleanPath = this.cleanPath(urlPath);

    const out = { original: cleanPath };

    if (!cleanPath && this.defaultRoute)
      return { ...out, target: this.defaultRoute, rewrite: true };

    const route = this.selectRoute(cleanPath);
    if (!route) return { ...out, target: cleanPath, rewrite: false };

    return { ...out, target: route.target, rewrite: true };
  }
}
