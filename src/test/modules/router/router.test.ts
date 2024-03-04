import { expect } from "chai";
import Router from "../../../modules/router";
import { Request, Response, NextFunction } from "express";

import Base from "../../../core/base";
import Logger from "../../../logger";
import { getMock } from "../../_utils";
import { LogLevel } from "../../../logger/types";

Logger.init({ logLevel: LogLevel.FATAL });

describe("Router", () => {
  let router: Router;
  const req: Request = {
    path: "",
    url: "",
    query: {},
    params: {},
  } as unknown as Request;
  const res: Response = {} as unknown as Response;
  const next: NextFunction = () => {};

  beforeEach(async () => {
    const mockBase = getMock(Base);
    router = new Router(mockBase);
    router.routes = {
      "/users/:id": "USERS",
      "/something": "/foo/bar?something=1",
      "/exciting/:thing": (params: any, req: Request) => {
        return `/dogs/${params.thing}/${req.query.breed}`;
      },
    };
    router.defaultRoute = "DEFAULT";
    await router.init();
  });

  it("should route to the default route for empty paths", async () => {
    req.path = "";
    router.handleRoutes(req, res, next);
    expect(req.url).to.equal("DEFAULT");
    expect(req.params).to.deep.equal({});
    expect(req.query).to.deep.equal({});
  });

  it("should handle route params", async () => {
    req.path = "/users/123";
    router.handleRoutes(req, res, next);
    expect(req.url).to.equal("USERS");
    expect(req.params).to.deep.equal({ id: "123" });
    expect(req.query).to.deep.equal({});
  });

  it("should handle functions as route targets", async () => {
    req.query = { breed: "poodle" };
    req.path = "/exciting/dog";
    req.url = "/exciting/dog?breed=poodle";
    router.handleRoutes(req, res, next);
    expect(req.url).to.equal("/dogs/dog/poodle");
    expect(req.params).to.deep.equal({ thing: "dog" });
    expect(req.query).to.deep.equal({});
  });
});
