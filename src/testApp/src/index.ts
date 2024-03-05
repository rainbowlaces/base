import Base, { utils } from "../../index";

const base = new Base(utils.file.getDirname(import.meta.url));

await base.init();

base.go();
