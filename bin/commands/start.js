import { spawn } from 'child_process';
import path from 'path';

export function createStartCommand(program) {
  program
    .command('start')
    .description('Runs a pre-built JavaScript file. Does not build.')
    .argument('[entryFile]', 'The entry file to execute (absolute, or relative to project root).')
    .option('--dev', 'Run with debugging flags and log formatting.')
    .action(async (entryFile, options) => {
      const { projectRoot } = program.paths;
      const { quietLog, quietError } = program;
      
      let finalEntryFile;

      //
      // --- THE PATH RESOLUTION LOGIC ---
      //
      if (entryFile) {
        // If the path is absolute, use it as is. Otherwise, join it with the project root.
        finalEntryFile = path.isAbsolute(entryFile)
          ? entryFile
          : path.join(projectRoot, entryFile);
      } else {
        // If no entry file is provided at all, create a sensible default absolute path.
        finalEntryFile = path.join(projectRoot, 'dist', 'src', 'index.js');
      }

      let commandToRun;

      // --- Dev Mode ---
      if (options.dev) {
        commandToRun = [
            'NODE_ENV=development',
            'node',
            '--inspect',
            '-r source-map-support/register',
            finalEntryFile,
            '2>&1',
            '|',
            'npx base format-log'
        ].join(' ');

      // --- Standard Mode ---
      } else {
        commandToRun = `node ${finalEntryFile}`;
      }

      quietLog(`Executing:\n> ${commandToRun}`);

      try {
        spawn(commandToRun, {
            stdio: 'inherit',
            shell: true,
        });
      } catch (e) {
        quietError('❌ Failed to start the application. Colour me surprised.', e);
        process.exit(1);
      }
    });
}