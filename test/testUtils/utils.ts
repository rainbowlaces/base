import { BaseDi, type BaseLogger } from "../../src";
import { type BaseModule } from "../../src/core/module/baseModule";
import { type BaseClassConfig } from "../../src/core/config/types";
import { type FileSystem } from "../../src/utils/fileSystem";

export function getMockLogger(): BaseLogger {
    return {
        error: () => { /* Mock logger method */ },
        info: () => { /* Mock logger method */ },
        warn: () => { /* Mock logger method */ },
        debug: () => { /* Mock logger method */ },
        trace: () => { /* Mock logger method */ },
        fatal: () => { /* Mock logger method */ }
    } as unknown as BaseLogger;
}

export function getMockFileSystem(): FileSystem {
    const now = new Date();
    return {
        readdir: async () => [],
        readFile: async () => Buffer.alloc(0),
        stat: async () => ({
            isFile: () => false,
            isDirectory: () => false,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isSymbolicLink: () => false,
            isFIFO: () => false,
            isSocket: () => false,
            size: 0,
            mode: 0,
            uid: 0,
            gid: 0,
            atime: now,
            mtime: now,
            ctime: now,
            birthtime: now,
            atimeMs: now.getTime(),
            mtimeMs: now.getTime(),
            ctimeMs: now.getTime(),
            birthtimeMs: now.getTime(),
            dev: 0,
            ino: 0,
            nlink: 0,
            rdev: 0,
            blksize: 0,
            blocks: 0
        })
    };
}

export function getModuleWithMocks<C extends BaseClassConfig, T extends BaseModule<C>>(name: string, builder: () => T, inject: Record<string, unknown> = {}): { module: T; logger: BaseLogger; config: C; } {
    BaseDi.reset();
    const logger = getMockLogger();
    BaseDi.register("BaseLogger", { value: logger, singleton: true });
    const config = {} as C;
    BaseDi.register({ key: `Config.${name}`, singleton: true, type: "scalar", value: config });

    for (const [key, value] of Object.entries(inject)) {
        BaseDi.register(key, { value, singleton: true });
    }

    const module = builder();
    return { module, logger, config };
}