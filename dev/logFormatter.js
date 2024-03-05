/* eslint-disable node/no-unpublished-import */
import readline from "readline";
import process from "process";
import chalk from "chalk";
import { DateTime } from "luxon";

// Create an interface for reading from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// Event listener for each line of input
rl.on("line", (line) => {
  try {
    const log = JSON.parse(line);

    const timestamp = DateTime.fromISO(log.timestamp).toFormat(
      "yyyy-MM-dd HH:mm:ss",
    );

    let level = log.level.padEnd(8, " ");
    let message = chalk.gray(log.message);
    switch (log.level) {
      case "DEBUG":
        level = chalk.gray(level);
        message = chalk.gray(log.message);
        break;
      case "INFO":
        level = chalk.blue(level);
        message = chalk.white(log.message);
        break;
      case "WARNING":
        level = chalk.yellow(level);
        message = chalk.bold.white(log.message);
        break;
      case "ERROR":
      case "FATAL":
        level = chalk.red(level);
        message = chalk.bold.white(log.message);
        break;
    }

    const namespace = chalk.magenta.bold(
      log.namespace.toUpperCase().padEnd(15, " "),
    );

    console.log(`${timestamp} ${namespace} ${level} ${message}`);
    if (log.tags.length) {
      console.log(
        "Tags: ",
        log.tags.map((tag) => chalk.bgBlue.whiteBright(` ${tag} `)).join(" "),
      );
    }
    if (Object.values(log.context).length) {
      console.log(chalk.gray(JSON.stringify(log.context, null, 2)));
    }
  } catch (e) {
    console.error(line);
  }
});
