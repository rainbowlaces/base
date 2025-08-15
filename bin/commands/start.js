import { spawn } from "child_process";
import path from "path";
import { PassThrough } from "stream";
import { fileURLToPath } from "url";

export function createStartCommand(program) {
  program
    .command("start")
    .description("Runs a pre-built JavaScript file. Does not build.")
    .argument(
      "[entryFile]",
      "The entry file to execute (absolute, or relative to project root)."
    )
    .option("--dev", "Run with debugging flags and log formatting.")
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
        finalEntryFile = path.join(projectRoot, "dist", "src", "index.js");
      }

      try {
        if (options.dev) {
          // Dev mode: spawn app with debug flags and pipe both stdout and stderr
          // through the base formatter without using a shell pipeline.

          // Resolve path to CLI for running `format-log` subcommand without shell
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const cliPath = path.resolve(__dirname, "..", "cli.js");

          // Spawn the application process
          const appProc = spawn(
            process.execPath,
            [
              "--inspect",
              "-r",
              "dotenv/config",
              "-r",
              "source-map-support/register",
              finalEntryFile,
            ],
            {
              cwd: projectRoot,
              env: { ...process.env, NODE_ENV: "development" },
              stdio: ["ignore", "pipe", "pipe"],
              // Keep the app in the same process group so it receives terminal signals too.
              detached: false,
            }
          );

          // Spawn the formatter process: `node <cliPath> format-log`
          const fmtProc = spawn(
            process.execPath,
            [
              cliPath,
              "format-log",
              // inherit quiet flags from parent if present
              ...(process.argv.includes("-q") ? ["-q"] : []),
              ...(process.argv.includes("-e") ? ["-e"] : []),
              ...(process.argv.includes("-s") ? ["-s"] : []),
            ],
            {
              stdio: ["pipe", "inherit", "inherit"],
              // Put formatter in its own group so Ctrl+C doesn't kill it before we can fallback.
              detached: true,
            }
          );

          // Merge stdout and stderr from app into a single stream for formatter
          const merged = new PassThrough();
          if (appProc.stdout) appProc.stdout.pipe(merged, { end: false });
          if (appProc.stderr) appProc.stderr.pipe(merged, { end: false });

          // End merged when both stdout/stderr emit 'end'. This helps keep the pipe alive
          // long enough to transmit shutdown logs that may be flushed late.
          let endCount = 0;
          const tryEnd = () => {
            endCount += 1;
            if (endCount >= 2) merged.end();
          };
          if (appProc.stdout) appProc.stdout.on("end", tryEnd);
          if (appProc.stderr) appProc.stderr.on("end", tryEnd);

          // Pipe merged logs to formatter stdin
          merged.pipe(fmtProc.stdin);

          // Fallback: if formatter fails or exits, pipe logs directly to parent stdout
          const enableDirectOutput = () => {
            try {
              merged.unpipe(fmtProc.stdin);
            } catch {}
            try {
              fmtProc.stdin?.destroy();
            } catch {}
            program.quietError(
              "[base:start] Log formatter unavailable; falling back to raw output"
            );
            merged.pipe(process.stdout);
          };

          quietLog(
            `Executing (dev): node --inspect -r dotenv/config -r source-map-support/register ${finalEntryFile} | base format-log`
          );

          // Forward termination signals to the app for graceful shutdown.
          // Important: Do NOT forward SIGINT when child is in the same
          // process group (detached:false). The child already receives
          // Ctrl+C directly from the TTY, and forwarding would cause
          // duplicate signals (SIGINT + mapped SIGTERM).
          const forwarded = new Set();
          const forward = (sig) => {
            // Skip forwarding SIGINT; terminal already delivers it to child
            if (sig === "SIGINT") return;
            if (!forwarded.has(sig)) {
              forwarded.add(sig);
              program.quietLog(
                `[base:start] Forwarding ${sig} to app (pid ${appProc.pid})`
              );
            }
            try {
              // If app already exited, ignore
              if (appProc.exitCode === null && appProc.signalCode === null) {
                appProc.kill(sig);
              }
            } catch (e) {
              program.quietError(
                `[base:start] Failed to forward ${sig} to app:`,
                e?.message || e
              );
            }
          };
          process.on("SIGINT", () => forward("SIGINT"));
          process.on("SIGTERM", () => forward("SIGTERM"));
          process.on("SIGQUIT", () => forward("SIGQUIT"));
          process.on("SIGHUP", () => forward("SIGHUP"));

          // Exit parent when app exits; prefer app's exit code, but first drain logs
          appProc.on("exit", (code, signal) => {
            program.quietLog(
              `[base:start] App exited` +
                (signal ? ` by signal ${signal}` : ` with code ${code}`)
            );

            // Close the merged stream once stdout/stderr close
            const endMerged = () => {
              try {
                merged.end();
              } catch {}
            };
            appProc.stdout?.once("close", endMerged);
            appProc.stderr?.once("close", endMerged);

            // After merged finishes piping, close formatter stdin to allow flush
            const gracefulFlushTimeout = Number(
              process.env.BASE_LOG_FLUSH_TIMEOUT_MS ?? 1000
            );

            const finishAndExit = () => {
              try {
                fmtProc.stdin?.end();
              } catch {}
              const done = () => {
                if (signal) {
                  process.exitCode = 0; // let parent exit cleanly
                } else {
                  process.exitCode = code ?? 0;
                }
              };
              // Wait for formatter to exit or time out
              let finished = false;
              const markDone = () => {
                if (finished) return;
                finished = true;
                done();
              };
              fmtProc.once("exit", markDone);
              setTimeout(markDone, gracefulFlushTimeout).unref?.();
            };

            if (merged.writableEnded) {
              finishAndExit();
            } else {
              merged.once("finish", finishAndExit);
              // Safety timeout in case finish never triggers
              setTimeout(finishAndExit, gracefulFlushTimeout).unref?.();
            }
          });

          // If formatter dies early, still allow parent to continue; log quietly
          fmtProc.on("error", (err) => {
            quietError("Log formatter failed:", err?.message || err);
            enableDirectOutput();
          });
          fmtProc.on("exit", (code) => {
            if (code !== 0) {
              enableDirectOutput();
            }
          });
        } else {
          // Standard mode: run the app directly with inherited stdio
          const appProc = spawn(process.execPath, [finalEntryFile], {
            cwd: projectRoot,
            env: { ...process.env },
            stdio: "inherit",
            detached: false,
          });

          // Forward signals (avoid duplicating SIGINT which the child already receives)
          const forward = (sig) => {
            try {
              if (sig !== "SIGINT") appProc.kill(sig);
            } catch {}
          };
          process.on("SIGINT", () => forward("SIGINT"));
          process.on("SIGTERM", () => forward("SIGTERM"));
          process.on("SIGQUIT", () => forward("SIGQUIT"));

          appProc.on("exit", (code, signal) => {
            if (signal) {
              process.exitCode = 0; // let parent exit cleanly
            } else {
              process.exitCode = code ?? 0;
            }
            // No aggressive group kill; let children shut down gracefully.
          });
        }
      } catch (e) {
        quietError(
          "❌ Failed to start the application. Colour me surprised.",
          e
        );
        process.exit(1);
      }
    });
}
