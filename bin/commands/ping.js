export function createPingCommand(program) {
  program
    .command('ping')
    .description('PING! PONG! (also shows resolved paths)')
    .action(() => {
      const { quietLog } = program;
      quietLog('PONG!');
      quietLog('');
      quietLog('Resolved paths:');
      quietLog(`  Framework root: ${program.paths.frameworkRoot}`);
      quietLog(`  Project root: ${program.paths.projectRoot}`);
      process.exit();
    });
}