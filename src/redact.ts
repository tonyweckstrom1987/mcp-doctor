/**
 * Peittää stdio-komennon argumenteista salaisuudelta näyttävät arvot ennen kuin komento tulostuu
 * raporttiin (teksti, JSON, CI-loki). Komento itse käynnistetään aina alkuperäisillä argumenteilla.
 *
 * Peitetään:
 *  - salaiselta kuulostavan lipun arvo: `--token xyz`, `--api-key=xyz` (vain pitkät liput: lyhyet kuten `-p` ovat monitulkintaisia)
 *  - ympäristömuuttujamuotoinen sijoitus: `API_KEY=xyz` (esim. `env API_KEY=xyz node server.js`)
 *  - URL:n käyttäjätunnus/salasana ja kyselyparametrit: `https://u:p@host/x?key=1` -> `https://***@host/x?***`,
 *    myös lipun tai sijoituksen arvona: `--db=postgres://u:p@h/x`, `DATABASE_URL=postgres://u:p@h/x`
 *  - salaiselta kuulostava HTTP-otsake arvona: `--header "Authorization: Bearer xyz"` -> `Authorization: ***`
 *    (esim. mcp-remote), sekä pelkkä `Bearer xyz` -> `Bearer ***`
 */
const SECRET_NAME = /(token|secret|passw(or)?d|passwd|pwd|api[-_]?key|apikey|access[-_]?key|private[-_]?key|client[-_]?secret|auth|credential|bearer|cookie|session)/i;
const MASK = "***";

function looksSecret(name: string): boolean {
  return SECRET_NAME.test(name);
}

function maskUrl(arg: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(arg)) return arg;
  let u: URL;
  try {
    u = new URL(arg);
  } catch {
    return arg;
  }
  if (!u.username && !u.password && !u.search) return arg;
  const auth = u.username || u.password ? `${MASK}@` : "";
  const query = u.search ? `?${MASK}` : "";
  return `${u.protocol}//${auth}${u.host}${u.pathname}${query}${u.hash}`;
}

const HEADER = /^(\s*)([A-Za-z0-9-]+)(\s*:\s*)(.*)$/s;
const BEARER = /^(\s*)(bearer|basic|token)(\s+)(\S.*)$/is;

/** Peittää yksittäisen arvon: salainen otsake, Bearer-arvo tai URL:n tunnukset ja kyselyparametrit. */
function maskValue(value: string): string {
  const h = HEADER.exec(value);
  if (h && looksSecret(h[2]) && h[4] !== "") return `${h[1]}${h[2]}${h[3]}${MASK}`;
  const b = BEARER.exec(value);
  if (b) return `${b[1]}${b[2]}${b[3]}${MASK}`;
  return maskUrl(value);
}

export function redactArgs(argv: readonly string[]): string[] {
  const out: string[] = [];
  let maskNext = false;
  for (const arg of argv) {
    if (maskNext) {
      out.push(MASK);
      maskNext = false;
      continue;
    }
    const long = /^(--?[A-Za-z][\w.-]*)(=(.*))?$/s.exec(arg);
    if (long && long[1].startsWith("--") && looksSecret(long[1])) {
      if (long[2] !== undefined) out.push(`${long[1]}=${MASK}`);
      else {
        out.push(arg);
        maskNext = true;
      }
      continue;
    }
    if (long && long[1].startsWith("--") && long[3] !== undefined) {
      // Tavallisen lipun arvo voi silti sisältää tunnuksia: --db=postgres://u:p@h/x, --header=Authorization:...
      out.push(`${long[1]}=${maskValue(long[3])}`);
      continue;
    }
    const assign = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(arg);
    if (assign && looksSecret(assign[1])) {
      out.push(`${assign[1]}=${MASK}`);
      continue;
    }
    if (assign) {
      out.push(`${assign[1]}=${maskValue(assign[2])}`);
      continue;
    }
    out.push(maskValue(arg));
  }
  return out;
}
