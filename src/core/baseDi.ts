import { BaseDiWrapper, Constructor, Instance, Scalar } from "./types";

export class BaseDi {
  private static instances = new Map<string, BaseDiWrapper<unknown>>();
  private static autoloadedFiles = new Set<string>();

  static create(): BaseDi {
    return new this();
  }

  static async autoload(root: string, ignore: string[] = []): Promise<void> {
    if (BaseDi.matchesIgnorePattern(root, ignore)) {
      return;
    }
    console.log(`${root}:`);
    const fs = await import("fs/promises");
    const path = await import("path");
    const files = await fs.readdir(root, { withFileTypes: true });
    for (const file of files) {
      const filePath = path.join(root, file.name);
      if (file.isDirectory()) {
        await this.autoload(filePath, ignore);
      } else if (file.isFile() && file.name.endsWith(".js")) {
        if (BaseDi.matchesIgnorePattern(filePath, ignore)) {
          continue;
        }

        // Skip if already imported
        if (this.autoloadedFiles.has(filePath)) {
          continue;
        }

        try {
          await import(filePath);
          this.autoloadedFiles.add(filePath);
          console.log(` - ${path.basename(filePath)}`);
        } catch (err) {
          console.error(` - FAILED: ${path.basename(filePath)} - ${err}`);
          this.autoloadedFiles.add(filePath);
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

  static matchesIgnorePattern(filename: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      try {
        const urlPattern = new URLPattern({ pathname: pattern });
        return urlPattern.test(filename);
      } catch {
        // Fallback to exact string match if pattern is invalid
        return filename === pattern;
      }
    });
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
