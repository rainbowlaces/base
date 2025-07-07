import { type BaseModel } from "../baseModel";
import { type FieldOptions } from "../types";

export function field<T>(options: FieldOptions<T> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function<M extends BaseModel<any>>(target: ClassAccessorDecoratorTarget<M, T>, context: ClassAccessorDecoratorContext) {
        const constructor = target.constructor as typeof BaseModel;
        constructor.registerField(context.name as string, options);

        return {
            get: function(this: M): T {
                return this.get<T>(context.name as string);
            },
            set: function(this: M, value: T) {
                this.set<T>(context.name as string, value);
            },
        };
    }
}