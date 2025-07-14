import { ESLint } from 'eslint';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import { loadBuildConfig } from '../utils/buildConfig.js';

export function createLintCommand(program) {
  program
    .command('lint')
    .description("Lints the project using the base framework's ESLint configuration.")
    .argument('[paths...]', 'Optional list of files or directories to lint.') // <-- The new argument
    .option('--fix', 'Automatically fix linting problems.')
    .action(async (paths, options) => { // <-- Commander passes the new argument here
      const { projectRoot, frameworkRoot } = program.paths;
      const { quietLog, quietError } = program;
      
      quietLog('Linting project...');

      try {
        const eslint = new ESLint({
          overrideConfigFile: path.join(frameworkRoot, 'eslint.config.js'),
          fix: !!options.fix,
          cwd: projectRoot,
        });

        //
        // --- SMART CONFIG-BASED PATTERNS ---
        //
        // If the user provided paths, use them. Otherwise, use config-based defaults.
        let filesToLint;
        let displayTargets;
        if (paths.length > 0) {
          filesToLint = paths;
          displayTargets = filesToLint.join(', ');
        } else {
          // Load the base config to determine client setup
          const buildConfig = await loadBuildConfig(projectRoot);
          const hasClientConfig = fs.existsSync(path.join(projectRoot, buildConfig.client.tsconfig));
          
          if (hasClientConfig) {
            // Use config to determine what to exclude
            const clientDir = path.dirname(buildConfig.client.entryPoint);
            const allTsFiles = await glob('src/**/*.ts', { cwd: projectRoot });
            filesToLint = allTsFiles.filter(file => !file.startsWith(`${clientDir}/`));
            displayTargets = `src/**/*.ts (excluding ${clientDir}/)`;
            quietLog(`Detected client config - excluding ${clientDir}/ from lint`);
          } else {
            filesToLint = ['src/**/*.ts'];
            displayTargets = 'src/**/*.ts';
          }
        }
        
        quietLog(`Linting targets: ${displayTargets}`);

        const results = await eslint.lintFiles(filesToLint);
        
        if (options.fix) {
            await ESLint.outputFixes(results);
            quietLog('Applied fixable linting changes.');
        }

        const formatter = await eslint.loadFormatter('stylish');
        const resultText = await formatter.format(results);
        
        const { errorCount, warningCount } = results.reduce(
            (acc, result) => {
                acc.errorCount += result.errorCount;
                acc.warningCount += result.warningCount;
                return acc;
            },
            { errorCount: 0, warningCount: 0 }
        );

        if (errorCount > 0 || warningCount > 0) {
          quietLog(resultText);
        } else {
          quietLog('✅ No linting issues found. This feels suspicious.');
        }

        if (errorCount > 0) {
            process.exit(1);
        }

      } catch (e) {
        quietError('❌ An unexpected error occurred during linting.', e);
        process.exit(1);
      }
    });
}