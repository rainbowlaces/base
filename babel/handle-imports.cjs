/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require("fs");
const path = require("path");

module.exports = function () {
  return {
    visitor: {
      ImportDeclaration(babelPath, state) {
        modifyPathIfNecessary(babelPath, state);
      },
      ExportNamedDeclaration(babelPath, state) {
        if (babelPath.node.source) {
          modifyPathIfNecessary(babelPath, state);
        }
      },
      ExportAllDeclaration(babelPath, state) {
        if (babelPath.node.source) {
          modifyPathIfNecessary(babelPath, state);
        }
      },
    },
  };

  function modifyPathIfNecessary(babelPath, state) {
    let source = babelPath.node.source.value;
    if (!source.startsWith(".")) return;
    if (/\.\w+$/.test(source)) return;

    // Assuming the base directory is where the Babel is being run
    const basePath = state.file.opts.filename
      ? path.dirname(state.file.opts.filename)
      : process.cwd();
    const absolutePath = path.resolve(basePath, source);

    if (
      fs.existsSync(absolutePath) &&
      fs.lstatSync(absolutePath).isDirectory()
    ) {
      // Path resolves to a directory, append '/index.js'
      source += "/index.js";
    } else if (fs.existsSync(`${absolutePath}.ts`)) {
      // If adding .ts resolves the path, append '.js' instead
      source += ".js";
    } else {
      // Default case, just append '.js'
      source += ".js";
    }

    babelPath.node.source.value = source;
  }
};
