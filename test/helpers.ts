import { fileURLToPath } from "node:url";
import type { CliIo } from "../src/cli.js";

export const NODE = process.execPath;

export function fixture(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

export function makeIo(env: Record<string, string> = {}, files: Record<string, string> = {}): CliIo & { out: string; err: string } {
  const io = {
    out: "",
    err: "",
    stdout: (s: string) => void (io.out += s),
    stderr: (s: string) => void (io.err += s),
    env: { ...(process.env as Record<string, string>), ...env },
    readFile: (p: string) => {
      if (p in files) return files[p];
      throw new Error("ENOENT");
    },
  };
  return io;
}
