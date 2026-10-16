# mcp-doctor

Terveystarkastus MCP-palvelimelle. Yksi komento kertoo, toimiiko palvelimesi: vastaako se `initialize`-kättelyyn, ovatko työkalujen kuvaukset ja skeemat kunnossa ja onnistuvatko oikeat työkalukutsut. Raportti on luettava ihmiselle ja koneelle (JSON), ja poistumiskoodi sopii CI:hin.

*English summary: a CLI and GitHub Action that checks an MCP server's health: handshake, tool-schema lint and smoke calls with explicit example arguments. Human-readable or JSON report, exit code for CI, no API keys, no network access besides the server you point it at.*

Miksi: MCP-asiakkaat (Claude Desktop, Cursor) antavat vähän tietoa, kun palvelin tai työkalun skeema on rikki. Työkalu vain puuttuu listalta tai malli käyttää sitä väärin, ja kehittäjä jää arvailemaan. mcp-doctor löytää ongelmat ennen asiakasta.

## Asennus

Pakettia ei ole julkaistu npm:ään. Asenna lähteistä (Node 22.12+ tai 24):

```bash
git clone https://github.com/tonyweckstrom1987/mcp-doctor.git
cd mcp-doctor
npm ci          # asentaa ja kääntää (prepare-skripti)
node dist/bin.js --help
```

## Käyttö

stdio-palvelin (komento annetaan `--`-merkin jälkeen):

```bash
node dist/bin.js -- node ../oma-palvelin/dist/index.js
```

HTTP-palvelin (Streamable HTTP), tarvittaessa Bearer-tokenilla ympäristömuuttujasta:

```bash
export DOCTOR_TOKEN=...   # kirjoita itse, älä liitä tokenia komentoriville
node dist/bin.js --url http://127.0.0.1:3000/mcp --bearer-env DOCTOR_TOKEN
```

Esimerkkituloste (mcp-server-starter, savuajolla):

```
mcp-doctor: node ../starter/dist/index.js
Palvelin: mcp-server-starter 0.1.0, 2 työkalua
Savuajo:
  OK     greet (4 ms)
  OK     add (1 ms)
Yhteenveto: 0 virhettä, 0 varoitusta, 0 huomiota -> OK
```

| Valinta | Selitys |
| --- | --- |
| `--smoke <tiedosto>` | savuajo: kutsuu vain tiedostossa nimetyt työkalut |
| `--json` | raportti JSONina |
| `--strict` | varoituksetkin kaatavat ajon |
| `--timeout-ms <luku>` | yksittäisen pyynnön aikakatkaisu, oletus 10000 |
| `--env <NIMI>` | välittää ympäristömuuttujan stdio-palvelimelle (toistettava) |
| `--bearer-env <NIMI>` | HTTP-palvelimen Bearer-token tästä muuttujasta |

Poistumiskoodit: `0` kunnossa, `1` löydöksiä (virhe, tai varoitus `--strict`-tilassa), `2` käyttö- tai tiedostovirhe.

## Mitä tarkistetaan

| Tunniste | Vakavuus | Mitä |
| --- | --- | --- |
| `CONNECT_FAILED` | virhe | yhteys tai `initialize` epäonnistui, myös tuntematon protokollaversio. Viestissä näkyy stdio-palvelimen viimeinen stderr-teksti |
| `SERVER_INFO_MISSING` | varoitus | palvelin ei kerro nimeään |
| `TOOLS_CAPABILITY_MISSING` | varoitus | palvelin ei ilmoita tools-kykyä |
| `TOOLS_LIST_FAILED` | virhe | `tools/list` epäonnistui |
| `TOOLS_EMPTY` | varoitus | tools-kyky ilmoitettu, mutta lista tyhjä |
| `TOOLS_PAGINATION_LIMIT` | varoitus | lista jatkui yli 50 sivua, luku keskeytettiin |
| `TOOL_DUPLICATE` | virhe | sama nimi useammin kuin kerran |
| `TOOL_NAME_INVALID` | virhe | tyhjä, yli 128 merkkiä tai muita merkkejä kuin `A-Z a-z 0-9 _ - .` |
| `TOOL_NAME_PORTABILITY` | varoitus | ei sovi muotoon `[A-Za-z0-9_-]{1,64}`, jota osa asiakkaista vaatii |
| `TOOL_DESC_MISSING` / `TOOL_DESC_SHORT` | varoitus / huomio | kuvaus puuttuu / alle 20 merkkiä |
| `SCHEMA_NOT_OBJECT` | virhe | syöteskeema puuttuu tai sen `type` ei ole `object` |
| `SCHEMA_REQUIRED_INVALID` / `SCHEMA_REQUIRED_UNKNOWN` | virhe | `required` ei ole merkkijonolista / viittaa kenttään, jota ei ole |
| `SCHEMA_PROP_DESC_MISSING` | varoitus | kentältä puuttuu kuvaus |
| `SCHEMA_PROP_UNTYPED` | varoitus | kentällä ei ole `type`/`enum`/`const`/`$ref`/`anyOf`/`oneOf`/`allOf` |
| `OUTPUT_SCHEMA_NOT_OBJECT` | virhe | `outputSchema` ei ole `object` |
| `SMOKE_TOOL_NOT_FOUND` | virhe | savuajotiedosto nimeää työkalun, jota palvelimella ei ole |
| `SMOKE_TOOL_ERROR` | virhe | työkalu palautti `isError`, vaikka virhettä ei odotettu |
| `SMOKE_EXPECTED_ERROR` | virhe | odotettu virhe jäi tulematta |
| `SMOKE_CALL_FAILED` | virhe | kutsu epäonnistui (aikakatkaisu, protokollavirhe, `outputSchema`-vaatimus rikottu) |
| `SMOKE_EMPTY_RESULT` | varoitus | tulos on tyhjä |
| `SMOKE_SLOW` | varoitus | vastaus kesti yli `maxMs` (oletus 5000) |

## Savuajo

Savuajo kutsuu **vain** tiedostossa nimettyjä työkaluja, annetuilla argumenteilla. Työkaluja ei kutsuta arvaamalla, koska työkalu voi muuttaa dataa. Jätä muokkaavat työkalut pois tai käytä niille testiympäristöä.

```json
{
  "calls": [
    { "tool": "greet", "arguments": { "name": "Tony" } },
    { "tool": "poista_kaikki", "arguments": {}, "expectError": true },
    { "tool": "hidas_haku", "arguments": { "q": "x" }, "maxMs": 15000 }
  ]
}
```

Kentät: `tool` (pakollinen), `arguments` (oletus `{}`), `expectError` (oletus `false`), `maxMs` (oletus 5000). Pelkkä taulukko käy myös.

## GitHub Action

```yaml
- uses: actions/checkout@v7
- run: npm ci && npm run build        # oma palvelimesi
- uses: tonyweckstrom1987/mcp-doctor@main
  with:
    command: node dist/index.js
    smoke: smoke.json
    strict: "true"
```

Syötteet: `command` tai `url`, `smoke`, `strict`, `timeout-ms`, `env-names`, `bearer-env`. Stdio-palvelin näkee vain nimeämäsi ympäristömuuttujat: aseta arvot action-askeleen `env`-lohkossa ja listaa nimet syötteellä `env-names` (välilyönnein erotettuna). HTTP-palvelimen tokenin aseta samoin `env`-lohkossa secretistä ja anna muuttujan nimi syötteellä `bearer-env`. Syötteet välitetään kuoreen ympäristömuuttujina, ei komentoriville, joten ne eivät voi injektoida komentoja.

## Turvallisuus

- Työkalu käynnistää komennon, jonka itse annat, ja puhuu vain sille palvelimelle. Muita verkkoyhteyksiä tai API-avaimia ei ole.
- Stdio-palvelin saa vain `PATH`- ja perusmuuttujat. Muut ympäristömuuttujat välitetään vain nimeämällä ne `--env`-valinnalla.
- Bearer-token luetaan ympäristömuuttujasta, ei komentoriviltä, eikä sitä tulosteta. Tulostuva kohde-osoite jättää kyselyparametrit pois.
- Raportti ei sisällä työkalujen tuloksia, vain virheen ensimmäisen tekstirivin (enintään 300 merkkiä).
- Yhteysvirheen viestiin liitetään stdio-palvelimen viimeinen stderr-teksti. Jos palvelimesi kirjoittaa lokiin salaisuuksia, ne päätyvät CI-lokiin.

## Rajaukset

Ei tue vanhaa SSE-siirtoa eikä OAuth-kirjautumista. Tarkistaa työkalut, ei `resources`- tai `prompts`-osioita. JSON Schema -validointi on kevyt (rakenne, `required`, tyypit, kuvaukset), ei täyttä skeemavalidointia.

## Kehitys

```bash
npm ci
npm run typecheck
npm test        # 76 testiä, käynnistää oikeita stdio- ja HTTP-testipalvelimia
```

Testit ajetaan oikeita MCP-palvelimia vastaan (`test/fixtures/`): kunnossa oleva, huonosti määritelty, väärää protokollaversiota puhuva, heti kaatuva sekä sivuttava. Ennen julkaisua koodiin tehtiin tahallisia rikkomisia (mutaatiot), (22 kappaletta), ja jokainen niistä kaatoi testin.

## Lisenssi

MIT
