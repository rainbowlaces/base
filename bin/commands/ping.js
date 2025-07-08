export function createPingCommand(program) {
  program
    .command('ping')
    .description('PING! PONG! (also shows resolved paths)')
    .action(() => {
      console.log('PONG!');
      console.log('');
      console.log('Resolved paths:');
      console.log(`  Framework root: ${program.paths.frameworkRoot}`);
      console.log(`  Project root: ${program.paths.projectRoot}`);
      process.exit();
    });
}