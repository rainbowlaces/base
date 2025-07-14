#!/usr/bin/env node
import { Command } from 'commander';

import { createPingCommand } from './commands/ping.js';
import { createFormatLogCommand } from './commands/format-log.js';
import { createBuildCommand } from './commands/build.js';
import { createLintCommand } from './commands/lint.js';
import { createStartCommand } from './commands/start.js';

import { resolvePaths } from './utils/paths.js';
import { createAsciiBox } from './utils/ascii.js';
import { shouldShowHeader, quietError, quietLog } from './utils/quiet.js';
import { createRequire } from 'module';

const program = new Command();
const require = createRequire(import.meta.url);

const { version } = require('../package.json');

let paths;
try {
  paths = resolvePaths();
  
  const infoLines = [
    `Base Framework: ${version}`,
    `Framework: ${paths.frameworkRoot}`,
    `Project: ${paths.projectRoot}`
  ];
  
  // Only show header if not quiet
  if (shouldShowHeader()) {
    console.log(createAsciiBox(infoLines, 'Base Framework CLI'));
  }
} catch (error) {
  quietError(`Error: ${error.message}`);
  process.exit(1);
}

program
    .name('base')
    .description('A CLI for the Base Framework.')
    .version(version)
    .option('-q, --quiet', 'suppress header output')
    .option('-e, --errors', 'only show errors')
    .option('-s, --silent', 'totally silent (no output)');

// Make paths available to commands
program.paths = paths;

// Make quiet utilities available to commands
program.quietLog = quietLog;
program.quietError = quietError;

createPingCommand(program);
createFormatLogCommand(program);
createBuildCommand(program);
createLintCommand(program);
createStartCommand(program);

program.parse(process.argv);