#!/usr/bin/env node
import { Command } from 'commander';

import { createPingCommand } from './commands/ping.js';
import { createFormatLogCommand } from './commands/format-log.js';
import { createBuildCommand } from './commands/build.js';
import { createLintCommand } from './commands/lint.js';
import { createStartCommand } from './commands/start.js';

import { resolvePaths } from './utils/paths.js';
import { createAsciiBox } from './utils/ascii.js';
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
  
  console.log(createAsciiBox(infoLines, 'Base Framework CLI'));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

program
    .name('base')
    .description('A CLI for the Base Framework.')
    .version(version);

// Make paths available to commands
program.paths = paths;

createPingCommand(program);
createFormatLogCommand(program);
createBuildCommand(program);
createLintCommand(program);
createStartCommand(program);

program.parse(process.argv);