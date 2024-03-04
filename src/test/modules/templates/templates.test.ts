import { expect } from "chai";
import Templates from "../../../modules/templates";
import path from "path";

import { fileURLToPath } from "url";
import { getMock, normalizeForDiff } from "../../_utils";

import Base from "../../../core/base";
import Logger from "../../../logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Logger.init();

describe("Templates", () => {
  let templates: Templates;

  beforeEach(async () => {
    const mockBase = getMock(Base);
    (mockBase as any)._fsRoot = path.join(__dirname, "testTemplates");
    templates = new Templates(mockBase);
    await templates.init();
  });

  it("should render a template", async () => {
    const rendered = templates.render("test", {
      name: "test",
      show: true,
      hideThings: true,
      items: ["salmon", "cod", "trout"],
    });
    expect(await normalizeForDiff(rendered)).to.equal(
      await normalizeForDiff(`
          <h1>test</h1> 
          <h1>I'M VISIBLE!</h1>
          <h1>salmon</h1>
          <h1>cod</h1>
          <h1>trout</h1>`),
    );
  });
});
