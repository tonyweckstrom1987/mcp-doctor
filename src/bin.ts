#!/usr/bin/env node
import { main, realIo } from "./cli.js";

main(process.argv.slice(2), realIo()).then((code) => {
  process.exitCode = code;
});
