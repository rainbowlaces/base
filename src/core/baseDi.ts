import { BaseDiWrapper, Constructor, Instance, Scalar } from "./types";

export default class BaseDi {
  private static instances: Map<string, BaseDiWrapper<unknown>> = new Map();

  static create(): BaseDi {
    return new this();
  }

  static async autoload(root: string, ignore: string[] = []): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const files = await fs.readdir(root, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(root, file.name);
      if (file.isDirectory()) {
        await this.autoload(filePath, ignore);
      } else if (file.isFile() && file.name.endsWith(".js")) {
        if (
          ignore.some((i) =>
            i.endsWith("*")
              ? file.name.startsWith(i.slice(0, -1))
              : file.name === i,
          )
        ) {
          continue;
        }

        try {
          await import(filePath);
        } catch (error) {
          console.warn(`Failed to import ${filePath}:`, error);
        }
      }
    }
  }

  resolve<T>(key: string | Constructor<T>, ...args: unknown[]): T | null {
    if (BaseDi.isConstructor(key)) {
      key = key.name;
    }
    const wrapper = BaseDi.instances.get(key as string) as BaseDiWrapper<T>;
    if (!wrapper) return null;

    if (wrapper.singleton) return wrapper.value as T;
    if (wrapper.type === "constructor")
      return new (wrapper.value as Constructor<T>)(...args);

    throw new Error(`Invalid type for key ${key}`);
  }

  static register(
    value: Constructor<unknown> | Instance<unknown> | Scalar,
    wrapper: string | BaseDiWrapper<unknown> = {},
  ): void {
    if (typeof wrapper === "string") {
      wrapper = { key: wrapper };
    }

    if (BaseDi.isConstructor(value)) {
      wrapper = {
        singleton: false,
        key: (value as Constructor<unknown>).name,
        ...wrapper,
        type: "constructor",
        value,
      };
    } else if (BaseDi.isInstance(value)) {
      wrapper = {
        key: (value as object).constructor.name,
        ...wrapper,
        singleton: true,
        type: "instance",
        value,
      };
    } else if (BaseDi.isScalar(value)) {
      wrapper = {
        ...wrapper,
        singleton: true,
        type: "scalar",
        value,
      };
      if (!wrapper.key) throw new Error("Key is required for scalar values");
    } else {
      throw new Error("Invalid value type");
    }
    BaseDi.instances.set(wrapper.key as string, wrapper);
  }

  private static isInstance(value: unknown): value is Instance<never> {
    return typeof value === "object";
  }

  private static isConstructor(value: unknown): value is Constructor<never> {
    return typeof value === "function" && !!value.prototype;
  }

  private static isScalar(value: unknown): value is Scalar {
    return !BaseDi.isInstance(value) && !BaseDi.isConstructor(value);
  }
}
