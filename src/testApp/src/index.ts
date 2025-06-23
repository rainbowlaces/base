import Base from "../../core/base";
const base = new Base(import.meta.url);

(async () => {
  await base.init();
})();
