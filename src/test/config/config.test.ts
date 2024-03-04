import { expect } from "chai";
import Config from "../../config";
import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Config", () => {
  let config: Config;

  describe("init", () => {
    describe("when no environment is specified", () => {
      beforeEach(async () => {
        config = new Config(path.join(__dirname, "testConfig"));
        await config.init();
      });
      it("should load the default configuration", () => {
        expect(config.getNamespace("base")).to.deep.equal({
          hello: "world",
          override: "me",
        });
      });
    });

    describe("when an environment is specified", () => {
      beforeEach(async () => {
        config = new Config(path.join(__dirname, "testConfig"), "development");
        await config.init();
      });
      it("should load the default configuration", () => {
        expect(config.getNamespace("base")).to.deep.equal({
          hello: "developers",
          override: "you",
          extra: "config",
        });
      });
    });

    describe("when an environment is specified but the config file fails to load", () => {
      it("should throw an error", async () => {
        let error: string = "";
        try {
          const c = new Config(
            path.join(__dirname, "testConfig"),
            "nonExistant",
          );
          await c.init();
        } catch (e) {
          error = (e as Error).message;
        }
        expect(error).to.equal(
          "Failed to load environment-specific(nonExistant) configuration.",
        );
      });
    });
  });

  describe("getNamespace", () => {
    it("should return {} if the namespace does not exist", () => {
      config = new Config(path.join(__dirname, "testConfig"));
      expect(config.getNamespace("nonExistant")).to.deep.equal({});
    });
  });
});
