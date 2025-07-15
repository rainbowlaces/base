/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { registerDi } from "../../di/decorators/registerDi.js";
import { FIELD_METADATA_SYMBOL } from "./field.js";
import { type BaseModel } from "../baseModel.js";
import { type ModelConstructor, type FieldMetadata } from "../types.js";

export function model<T extends BaseModel>(ctor: ModelConstructor<T>): void {
  // Collect field metadata from entire prototype chain
  let currentProto = ctor.prototype;
  
  while (currentProto && currentProto !== Object.prototype) {
    for (const d of Object.values(Object.getOwnPropertyDescriptors(currentProto))) {
      const info = (d.get as any)?.[FIELD_METADATA_SYMBOL] ?? (d.set as any)?.[FIELD_METADATA_SYMBOL];

      if (!info) continue; // not a @field accessor

      // Register the collected field with the static schema using type assertion to access private method
      (ctor as unknown as { addField: (name: string, meta: FieldMetadata) => void }).addField(info.name, info.meta); 
    }
    
    // Move up the prototype chain
    currentProto = Object.getPrototypeOf(currentProto);
  }

  // Register with DI container
  registerDi({ singleton: false, tags: ["Model"] })(ctor, {} as ClassDecoratorContext);
}
