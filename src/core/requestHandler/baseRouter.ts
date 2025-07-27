import { registerDi } from "../di/decorators/registerDi.js";
import { type RouteTarget, type UrlParams, type Routes } from "./types.js";
import { BaseClassConfig, type ConfigData } from "../config/types.js";
import { config } from "../config/decorators/config.js";
import { configClass } from "../config/decorators/provider.js";
import { BaseError } from "../baseErrors.js";

@configClass("BaseRouter")
class BaseRouterConfig extends BaseClassConfig {
  routes: Routes = {};
  defaultRoute: string = "/";
}

declare module "../config/types.js" {
  interface BaseAppConfig {
    BaseRouter?: ConfigData<BaseRouterConfig>;
  }
}

@registerDi({  setup: true, phase: 40, singleton: true })
export class BaseRouter {
  private routes: Routes = {};
  private defaultRoute?: string;

  @config<BaseRouterConfig>("BaseRouter")
  private accessor config!: BaseRouterConfig;

  public async setup(): Promise<void> {
    this.routes = this.config.routes;
    this.defaultRoute = this.config.defaultRoute;
    console.log(`[BaseRouter] Setup complete with routes: ${JSON.stringify(this.routes)}`);
  }

  private cleanPath(path: string): string {
    return path
      .split("/")
      .filter((s: string) => !!s)
      .join("/");
  }

  private static createURLPattern(route: string): URLPattern {
    try {
      return new URLPattern({ pathname: route });
    } catch (err) {
      throw new BaseError(`Invalid route pattern: ${route}. ${String(err)}`);
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
      Object.entries(match.pathname.groups).filter(([_, value]) => value !== undefined)
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
