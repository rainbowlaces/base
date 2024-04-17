import Base from "../../core/base";
import TestModuleA from "./modules/testModuleA";
import TestModuleB from "./modules/testModuleB";

const base = new Base(import.meta.url);

await base.init();

base.addModule(TestModuleA);
base.addModule(TestModuleB);

base.go();
