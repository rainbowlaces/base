import resolveAsync from "resolve";

export async function resolveModule(
  module: string,
  root: string,
): Promise<string> {
  return new Promise(function (resolve, reject) {
    resolveAsync(module, { basedir: root }, (err, res) => {
      if (err) return reject(err);
      return resolve(res as string);
    });
  });
}
