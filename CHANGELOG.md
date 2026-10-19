# Changelog

Muoto perustuu [Keep a Changelogiin](https://keepachangelog.com/fi/1.0.0/), ja versiointi noudattaa [Semantic Versioningia](https://semver.org/lang/fi/).

## [0.3.0] - 2026-10-19

Korjaukset yöjonon koodikatselmoinnin (19.10.2026) löydöksistä.

### Korjattu

- Turvallisuus: palvelimelta tuleva teksti (palvelimen nimi ja versio, työkalun nimi, löydösviestit) siivotaan ennen tekstitulostetta. Ohjausmerkit ja rivinvaihdot poistetaan, joten haitallinen palvelin ei voi lisätä tulosteeseen GitHub Actionsin työnkulkukomentoja (`::warning::`, `::stop-commands::`) eikä lähettää terminaalille escape-sekvenssejä. JSON-tuloste oli jo turvallinen.
- `expectError: true` hyväksyy nyt myös JSON-RPC-virheen (esim. `-32602 Invalid params`), ei vain `isError`-vastausta. Aikakatkaisu ja katkennut yhteys eivät silti kelpaa odotettuna virheenä. Tilanne näkyy huomiona `SMOKE_EXPECTED_PROTOCOL_ERROR`.
- `required`-tarkistus ei enää huomauta kentistä, jotka voivat tulla `allOf`/`anyOf`/`oneOf`/`$ref`-rakenteen kautta, eikä pidä perittyjä avaimia (kuten `constructor`) kenttinä. Boolean-skeema (`true`/`false`) kentän määrittelynä ei enää anna varoitusta.
- Tyhjä savuajotiedosto (`{"calls": []}`) on käyttövirhe: se raportoisi OK, vaikka mitään ei testattu.
- Jos työkalulistaa ei saatu (kyky puuttuu tai `tools/list` epäonnistui), `SMOKE_TOOL_NOT_FOUND` kertoo sen eikä väitä, ettei työkalua ole.
- Toistuva `nextCursor` tunnistetaan (`TOOLS_PAGINATION_LOOP`) eikä listausta ajeta 50 sivun rajaan asti.
- Action: `env-names`-syöte ei laajene tiedostonimiksi; `command`-syötteen lainausmerkkirajoitus on dokumentoitu.

### Muutettu

- Odottamaton sisäinen virhe palauttaa poistumiskoodin `3` (aiemmin `2`, joka tarkoittaa käyttövirhettä), jotta CI erottaa työkalun oman vian väärästä komennosta.

### Lisätty

- Varoitus, kun `--bearer-env` lähettää tokenin salaamattomalla `http:`-yhteydellä muuhun kuin localhost-osoitteeseen.

## [0.2.0] - 2026-10-16

Ensimmäinen npm-julkaisu: `@tonyweckstrom/mcp-doctor`.

### Lisätty

- Julkaisu npm:ään scopattuna nimellä (nimi `mcp-doctor` oli jo toisen käytössä). `npx @tonyweckstrom/mcp-doctor` toimii ilman asennusta; komento on edelleen `mcp-doctor`.
- `--version`-valinta.
- Julkaisutiedot `package.json`:iin (repository, homepage, bugs, keywords, `publishConfig`), `prepublishOnly`-tarkistus ja CI:n pakettitesti (npm pack, asennus puhtaaseen kansioon, ajo).
- README: npx-käyttö, esimerkkituloste virheellisestä palvelimesta ja osio "Vaihtoehtoja ja miksi tämä" (vertailu muihin MCP-testityökaluihin).

### Korjattu

- Asiakkaan ilmoittama versio luetaan nyt `package.json`:ista (oli kovakoodattu `0.1.0`). Testi varmistaa, että palvelin näkee oikean version.
- Palvelimen oma `--help` tai `--version` `--`-erottimen jälkeen ei enää laukaise mcp-doctorin omaa ohjetta.

## [0.1.0] - 2026-10-16

### Lisätty

- Ensimmäinen versio: initialize-kättely, työkalujen skeematarkistus, savuajo, GitHub Action.
