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

  let raw; let parsed = null;
  try { raw = line.trim(); if (raw.startsWith('{') && raw.endsWith('}')) parsed = JSON.parse(raw); } catch { /* fallthrough */ }

  // If not JSON, synthesize a minimal log object so everything gets uniform formatting
  const log = parsed || { message: line.trim() };
  // Basic tolerant extraction with defaults
  const ts = typeof log.timestamp === 'string' ? DateTime.fromISO(log.timestamp) : DateTime.invalid('missing');
  const timestamp = (ts.isValid ? ts : DateTime.now()).toFormat('yyyy-MM-dd HH:mm:ss');

  const rawLevel = (log.level || 'INFO').toString().toUpperCase();
  const levelPad = rawLevel.padEnd(8, ' ');
  let level = levelPad;

  // Build a working context object (may inject payload below)
  let context = (log.context && typeof log.context === 'object') ? { ...log.context } : {};
  const metaKeys = new Set(['timestamp','level','namespace','ns','tags','context','err','message']);

  const messageText = (() => {
    if (log.message != null) return String(log.message);
    if (log.err && log.err.message) return String(log.err.message);
    // No message field – move remaining non-meta fields into context.payload
    const payloadEntries = Object.entries(log).filter(([k]) => !metaKeys.has(k));
    if (payloadEntries.length) {
      context.payload = Object.fromEntries(payloadEntries);
      return 'Event';
    }
    return 'Event';
  })();
  let message = chalk.gray(messageText);
  let logger = console.log;
  switch (rawLevel) {
    case 'TRACE':
    case 'DEBUG':
      level = chalk.gray(levelPad);
      message = chalk.gray(messageText);
      logger = console.debug;
      break;
    case 'INFO':
      level = chalk.blue(levelPad);
      message = chalk.white(messageText);
      logger = console.info;
      break;
    case 'WARNING':
    case 'WARN':
      level = chalk.yellow(levelPad);
      message = chalk.bold.white(messageText);
      logger = console.warn;
      break;
    case 'ERROR':
      level = chalk.red(levelPad);
      message = chalk.bold.white(messageText);
      logger = console.error;
      break;
    case 'FATAL':
      level = chalk.red(levelPad);
      message = chalk.bold.white(messageText);
      logger = console.error;
      break;
  }

  const rawNamespace = (log.namespace || log.ns || 'log').toString().toUpperCase();
  const namespace = chalk.magenta.bold(rawNamespace.padEnd(15, ' '));

  logger(`${timestamp} ${namespace} ${level} ${message}`);

  const tags = Array.isArray(log.tags) ? log.tags : [];
  if (tags.length) {
    logger(
      'Tags: ',
      tags.map((tag) => chalk.bgBlue.whiteBright(` ${tag} `)).join(' '),
    );
  }

  if (Object.keys(context).length) {
    formatContext(context, logger);
  }
  // If only minimal fields were present, we still emitted a normalized line above.
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