import { expect } from "chai";
import Config from "../../config";
import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const trackable = {
  fields: {
    history: { type: "embed" },
  },
  embeds: {
    history: {
      type: "Action",
      fields: {
        right: { type: "embed", required: true },
        user: { type: "ref", required: true },
        timestamp: { type: "date", required: true },
      },
      references: {
        user: { ref: "users", type: "single" },
      },
      embeds: {
        right: {
          type: "Right",
          fields: {
            name: { type: "string", required: true },
          },
        },
      },
    },
  },
};

const testConfig = {
  auth: {
    enabled: true,
    password: "some password",
    username: "some user",
  },
  base: {
    port: 8080,
  },
  data: {
    collections: {
      users: {
        type: "User",
        fields: {
          ...trackable.fields,
          email: {
            required: true,
            type: "string",
            unique: true,
          },
          groups: {
            required: true,
            type: "ref",
          },
          name: {
            required: true,
            type: "string",
          },
          password: {
            required: true,
            type: "string",
          },
          personas: {
            type: "ref",
          },
        },
        references: {
          groups: {
            ref: "groups",
            type: "many",
          },
          personas: {
            ref: "personas",
            type: "many",
          },
        },
        embeds: trackable.embeds,
      },
      groups: {
        type: "Group",
        fields: {
          ...trackable.fields,
          name: {
            required: true,
            type: "string",
            unique: true,
          },
        },
        embeds: trackable.embeds,
      },
    },
    database: "some db",
    uri: "some uri",
  },
};

describe("Config", () => {
  let config: Config;

  describe("init", () => {
    describe("when no environment is specified", () => {
      beforeEach(async () => {
        config = new Config(path.join(__dirname, "testConfig"));
        await config.init();
      });
      it("should load the default configuration", () => {
        expect(config.getConfig()).to.deep.equal(testConfig);
      });
    });

    describe("when an environment is specified", () => {
      beforeEach(async () => {
        config = new Config(path.join(__dirname, "testConfig"), "development");
        await config.init();
      });
      it("should load the configuration for the specified environment", () => {
        expect(config.getNamespace("static_files").accessMode).to.equal("open");
        expect(config.getNamespace("data").database).to.equal("some dev db");
      });
    });

    describe("when templates are specified", () => {
      beforeEach(async () => {
        config = new Config(path.join(__dirname, "testConfig"), "production");
        await config.init();
      });
      it("should load the configuration with the specified templates", () => {
        expect(
          config.getNamespace("data").collections.users.embeds.history,
        ).to.deep.equal({
          type: "Action",
          fields: {
            right: { type: "embed", required: true },
            user: { type: "ref", required: true },
            timestamp: { type: "date", required: true },
          },
          references: {
            user: { ref: "users", type: "single" },
          },
          embeds: {
            right: {
              type: "Right",
              fields: {
                name: { type: "string", required: true },
              },
            },
          },
        });
        expect(
          config.getNamespace("data").collections.users.fields.history,
        ).to.deep.equal({ type: "embed" });
      });
    });
  });

  describe("getNamespace", () => {
    beforeEach(async () => {
      config = new Config(path.join(__dirname, "testConfig"));
      await config.init();
    });
    it("should return the config for the specified namespace", () => {
      expect(config.getNamespace("base")).to.deep.equal({ port: 8080 });
    });
    it("should return {} if the namespace does not exist", () => {
      expect(config.getNamespace("nonExistant")).to.deep.equal({});
    });
  });
});
