import { BaseDi, type BaseLogger } from "../../src/index.js";
import { type BaseModule } from "../../src/core/module/baseModule.js";
import { type BaseClassConfig } from "../../src/core/config/types.js";
import { type FileSystem } from "../../src/utils/fileSystem.js";
import { type BasePubSub } from "../../src/core/pubsub/basePubSub.js";
import { getConfigClass } from "../../src/core/config/decorators/provider.js";

import { mock } from 'node:test';

function debugLog(...args: unknown[]): void {
    if (process.env.LOG_DEBUG) {
        console.log(...args);
    }
}

export function getMockLogger(): BaseLogger {
    return {
        error: mock.fn((...args: unknown[]) => { debugLog("Mock error:", ...args); }),
        info: mock.fn((...args: unknown[]) => { debugLog("Mock info:", ...args); }),
        warn: mock.fn((...args: unknown[]) => { debugLog("Mock warn:", ...args); }),
        debug: mock.fn((...args: unknown[]) => { debugLog("Mock debug:", ...args); }),
        trace: mock.fn((...args: unknown[]) => { debugLog("Mock trace:", ...args); }),
        fatal: mock.fn((...args: unknown[]) => { debugLog("Mock fatal:", ...args); })
    } as unknown as BaseLogger;
}

export function getMockPubSub(): BasePubSub {
    return {
        pub: mock.fn(async () => { /* Mock pubsub method */ }),
        sub: mock.fn(() => ({ /* Mock subscription */ })),
        unsub: mock.fn(() => { /* Mock pubsub method */ }),
        once: mock.fn(async () => { /* Mock pubsub method */ }),
        setup: mock.fn(async () => { /* Mock pubsub method */ }),
        teardown: mock.fn(async () => { /* Mock pubsub method */ }),
        get inFlight() { return 0; }
    } as unknown as BasePubSub;
}

export function getMockFileSystem(): FileSystem {
    const now = new Date();
    
    return {
        readdir: mock.fn(async () => []),
        readFile: mock.fn(async () => Buffer.alloc(0)),
        stat: mock.fn(async () => ({
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
        }))
    };
}

export function getModuleWithMocks<C extends BaseClassConfig, T extends BaseModule<C>>(name: string, builder: () => T, inject: Record<string, unknown> = {}): { module: T; logger: BaseLogger; config: C; pubsub: BasePubSub; } {
    BaseDi.reset();
    const logger = getMockLogger();
    const pubsub = getMockPubSub();
    
    // Register the logger and pubsub as scalar values
    BaseDi.register(logger, { key: "BaseLogger", singleton: true, type: "scalar" });
    BaseDi.register(pubsub, { key: "BasePubSub", singleton: true, type: "scalar" });
    
    // Create a proper config class instance with defaults
    // We need to get the config class constructor from the registry    
    const configClass = getConfigClass(name);
    
    let config: C;
    if (configClass) {
        // Create instance of the config class with defaults
        config = new configClass() as C;
    } else {
        // Fall back to empty object for non-decorated configs
        config = {} as C;
    }
    
    BaseDi.register(config, { key: `Config.${name}`, singleton: true, type: "scalar" });

    for (const [key, value] of Object.entries(inject)) {
        BaseDi.register(value, { key, singleton: true, type: "scalar" });
    }

    // Now create the module AFTER all dependencies are registered
    const module = builder();

    return { module, logger, config, pubsub };
}