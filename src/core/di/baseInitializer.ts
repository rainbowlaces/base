import { type DiSetup } from "./types";
import { BaseDi } from "./baseDi";

interface InitializerItem {
  name: string;
  phase: number;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BaseInitializer {
  private static initializers: InitializerItem[] = [];

  static register(name: string, phase: number = 100): void {
    this.initializers.push({ name, phase });
  }

  static getInitializerList(): readonly InitializerItem[] {
    return this.initializers;
  }

  static clear(): void {
    this.initializers = [];
  }

  static async run(): Promise<void> {
    const phases = new Map<number, InitializerItem[]>();
    for (const item of this.initializers) {
      if (!phases.has(item.phase)) {
        phases.set(item.phase, []);
      }
      phases.get(item.phase)!.push(item);
    }

    const sortedPhaseNumbers = Array.from(phases.keys()).sort((a, b) => a - b);

    for (const phaseNumber of sortedPhaseNumbers) {
      const itemsInPhase = phases.get(phaseNumber)!;
      const phasePromises = itemsInPhase.map(async (item) => {
        const instance = BaseDi.resolve<DiSetup>(item.name);
        await instance.setup();
      });

      await Promise.all(phasePromises);
    }
  }
}