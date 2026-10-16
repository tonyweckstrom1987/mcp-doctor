import { createRequire } from "node:module";

const vaatii = createRequire(import.meta.url);

/** Paketin versio luetaan package.json:sta, ei kovakoodata (sama polku src/- ja dist/-hakemistosta). */
export const VERSIO: string = (vaatii("../package.json") as { version: string }).version;
