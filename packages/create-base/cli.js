#!/usr/bin/env node
import { spawn } from 'child_process';

// Simple proxy: pass all args straight through to base init.
const args = ['@rainbowlaces/base', 'init', ...process.argv.slice(2)];
spawn('npx', args, { stdio: 'inherit' });