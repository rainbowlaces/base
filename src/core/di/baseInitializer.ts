import { type DiSetup } from "./types.js";
import { BaseDi } from "./baseDi.js";
import { debugLog } from "../../utils/debugLog.js";
import { delay } from "../../utils/async.js";
import { BaseError } from "../baseErrors.js";

interface InitializerItem {
  name: string;
  phase: number;
}

 
export class BaseInitializer {
  private static initializers: InitializerItem[] = [];

  static register(name: string, phase: number = 100): void {
    debugLog(`[BaseInitializer] Registering initializer: ${name} (phase: ${phase})`);
    this.initializers.push({ name, phase });
    debugLog(`[BaseInitializer] Total initializers registered: ${this.initializers.length}`);
  }

  static getInitializerList(): readonly InitializerItem[] {
    debugLog(`[BaseInitializer] Getting initializer list (${this.initializers.length} items)`);
    return this.initializers;
  }

  static clear(): void {
    debugLog(`[BaseInitializer] Clearing ${this.initializers.length} initializers`);
    this.initializers = [];
    debugLog(`[BaseInitializer] Initializers cleared`);
  }

  static async run(): Promise<void> {
    debugLog(`[BaseInitializer] Starting initialization run with ${this.initializers.length} initializers`);
    debugLog(`[BaseInitializer] Initializers:`, this.initializers.map(i => `${i.name}(${i.phase})`).join(', '));

    const phases = new Map<number, InitializerItem[]>();
    debugLog(`[BaseInitializer] Grouping initializers by phase...`);
    
    for (const item of this.initializers) {
      debugLog(`[BaseInitializer] Processing initializer: ${item.name} (phase: ${item.phase})`);
      if (!phases.has(item.phase)) {
        debugLog(`[BaseInitializer] Creating new phase group: ${item.phase}`);
        phases.set(item.phase, []);
      }
      phases.get(item.phase)!.push(item);
    }

    debugLog(`[BaseInitializer] Total phases: ${phases.size}`);
    phases.forEach((items, phase) => {
      debugLog(`[BaseInitializer] Phase ${phase}: ${items.length} initializers (${items.map(i => i.name).join(', ')})`);
    });

    const sortedPhaseNumbers = Array.from(phases.keys()).sort((a, b) => a - b);
    debugLog(`[BaseInitializer] Execution order:`, sortedPhaseNumbers);

    for (const phaseNumber of sortedPhaseNumbers) {
      const itemsInPhase = phases.get(phaseNumber)!;
      debugLog(`[BaseInitializer] === Starting phase ${phaseNumber} with ${itemsInPhase.length} initializers ===`);
      
      const phasePromises = itemsInPhase.map(async (item) => {
        debugLog(`[BaseInitializer] Resolving and setting up: ${item.name}`);
        try {
          // Validate that the service is registered as a singleton
          const registration = BaseDi.getRegistration(item.name);
          if (!registration) {
            throw new BaseError(`No registration found for '${item.name}'`);
          }
          
          if (!registration.singleton) {
            throw new BaseError(`Cannot run setup on non-singleton service '${item.name}'. Setup/teardown only works with singleton: true services.`);
          }
          
          debugLog(`[BaseInitializer] Validated ${item.name} is singleton, proceeding with setup`);
          
          const instance = BaseDi.resolve<DiSetup>(item.name);
          debugLog(`[BaseInitializer] Successfully resolved ${item.name}`);
          
          // Check if setup method exists, if not use delay() as no-op
          if (typeof instance.setup === 'function') {
            debugLog(`[BaseInitializer] Calling setup() for: ${item.name}`);
            await instance.setup();
            debugLog(`[BaseInitializer] ✅ Setup completed for: ${item.name}`);
          } else {
            debugLog(`[BaseInitializer] No setup method found for ${item.name}, using delay() as no-op`);
            await delay();
            debugLog(`[BaseInitializer] ✅ No-op setup completed for: ${item.name}`);
          }
        } catch (error) {
          console.error(`[BaseInitializer] ❌ Setup failed for ${item.name}:`, error);
          throw error;
        }
      });

      debugLog(`[BaseInitializer] Waiting for phase ${phaseNumber} to complete...`);
      await Promise.all(phasePromises);
      debugLog(`[BaseInitializer] ✅ Phase ${phaseNumber} completed successfully`);
    }
    
    debugLog(`[BaseInitializer] 🎉 All initialization phases completed successfully!`);
  }
}