import readline from "readline";
import process from "process";
import chalk from "chalk";
import { DateTime } from "luxon";

export function createFormatLogCommand(program) {
  program
    .command('format-log')
    .description('Formats piped, newline-delimited JSON logs for readability.')
    .action(() => {
      const { quietError, quietLog } = program;
      
      if (process.stdin.isTTY) {
        quietError('Error: This command requires data to be piped to it.');
        quietLog('Usage: <some-command> | base format-log');
        process.exit(1);
      }

      // Create an interface for reading from stdin
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });

      // Event listener for each line of input
      rl.on("line", (line) => {
        processLine(line);
      });

      // Exit cleanly when the input ends
      rl.on("close", () => {
        process.exit(0);
      });

      // Ignore SIGINT so we can flush remaining input from the app during shutdown
      process.on('SIGINT', () => {
        quietLog('[base:format-log] Received SIGINT; waiting for input to finish');
        // Do not exit here; will exit on rl 'close'
      });
    });
}

function processLine(line) {
  if (!line) return;
  
  try {
    const log = JSON.parse(line);

    const timestamp = DateTime.fromISO(log.timestamp).toFormat(
      "yyyy-MM-dd HH:mm:ss",
    );

    let level = log.level.padEnd(8, " ");
    let message = chalk.gray(log.message);
    let logger = console.log;
    switch (log.level) {
      case "TRACE":
      case "DEBUG":
        level = chalk.gray(level);
        message = chalk.gray(log.message);
        logger = console.debug;
        break;
      case "INFO":
        level = chalk.blue(level);
        message = chalk.white(log.message);
        logger = console.info;
        break;
      case "WARNING":
        level = chalk.yellow(level);
        message = chalk.bold.white(log.message);
        logger = console.warn;
        break;
      case "ERROR":
      case "FATAL":
        level = chalk.red(level);
        message = chalk.bold.white(log.message);
        logger = console.error;
        break;
    }

    const namespace = chalk.magenta.bold(
      log.namespace.toUpperCase().padEnd(15, " "),
    );

    logger(`${timestamp} ${namespace} ${level} ${message}`);

    if (log.tags.length) {
      logger(
        "Tags: ",
        log.tags.map((tag) => chalk.bgBlue.whiteBright(` ${tag} `)).join(" "),
      );
    }
    if (Object.values(log.context).length) {
      formatContext(log.context, logger);
    }
  } catch (_e) {
    console.log(line);
  }
}

function formatContext(context, logger) {
  for (const [key, value] of Object.entries(context)) {
    if (key === 'error' && value && typeof value === 'object') {
      formatError(value, logger);
    } else {
      logger(chalk.gray(`${key}: ${JSON.stringify(value, null, 2)}`));
    }
  }
}

function formatError(error, logger) {
  logger(chalk.red.bold(`Error: ${error.name || 'Unknown'}`));
  logger(chalk.red(`Message: ${error.message}`));
  
  if (error.stack) {
    logger(chalk.red('Stack trace:'));
    if (Array.isArray(error.stack)) {
      error.stack.forEach((frame, index) => {
        logger(chalk.gray(`  ${index + 1}. ${frame}`));
      });
    } else {
      // Handle string stack traces
      const frames = error.stack.split('\n');
      frames.forEach((frame, index) => {
        if (frame.trim()) {
          logger(chalk.gray(`  ${index + 1}. ${frame.trim()}`));
        }
      });
    }
  }
}