import { registerDi } from "../../di/decorators/registerDi";

const FIELD_SYM = Symbol.for("model.field-meta");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function model(ctor: any): void {
  for (const d of Object.values(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    Object.getOwnPropertyDescriptors(ctor.prototype)
  )) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const info = (d.get as any)?.[FIELD_SYM] ?? (d.set as any)?.[FIELD_SYM];

    if (!info) continue; // not a @field accessor

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    ctor.addField(info.name, info.meta); 
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  (registerDi({ singleton: false, tags: ["Model"] }) as (t: Function) => void)(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    ctor
  );
}
