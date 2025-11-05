/* eslint-disable @typescript-eslint/no-explicit-any */

import { registerDi } from "../../di/decorators/registerDi.js";
import { FIELD_METADATA_SYMBOL } from "./field.js";
import { type ModelConstructor, type FieldMetadata, type IBaseModel } from "../types.js";

export function model<T extends IBaseModel>(ctor: ModelConstructor<T>): void {
  let currentProto = ctor.prototype;
  
  while (currentProto && currentProto !== Object.prototype) {
    for (const d of Object.values(Object.getOwnPropertyDescriptors(currentProto))) {

      const info = (d.get as any)?.[FIELD_METADATA_SYMBOL] ??
                   (d.set as any)?.[FIELD_METADATA_SYMBOL] ??
                   d.value?.[FIELD_METADATA_SYMBOL];

      if (!info) continue; // not a decorated field

      (ctor as unknown as { addField: (name: string, meta: FieldMetadata) => void }).addField(info.name, info.meta); 
    }
    
    currentProto = Object.getPrototypeOf(currentProto);
  }

  registerDi({ singleton: false, tags: ["Model"] })(ctor, {} as ClassDecoratorContext);
  
  (ctor as unknown as { onModelRegistered: () => void }).onModelRegistered();
}