#!/usr/bin/env node
import { spawn } from 'child_process';
const args = ['@rainbowlaces/base', 'init', ...process.argv.slice(2)];
spawn('npx', args, { stdio: 'inherit' });