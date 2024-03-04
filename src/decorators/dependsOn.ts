/**
 * Specifies dependencies for classes or methods. It is used to declare that a particular class or method
 * should only be loaded or called after its dependencies have been resolved. This decorator is crucial
 * for managing the initialization order of modules or components within the application, ensuring that
 * dependent features are properly set up before use.
 */
export default function dependsOn(dependencies: string | string[]) {
  return function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dependee: any,
    { kind }: ClassDecoratorContext | ClassMethodDecoratorContext,
  ) {
    const deps = Array.isArray(dependencies) ? dependencies : [dependencies];

    if (kind === "class") {
      dependee.dependsOn = deps;
      return dependee;
    }

    if (kind === "method") {
      dependee.dependsOn = deps;
      return dependee;
    }
  };
}
