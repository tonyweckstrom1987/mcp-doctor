# Changelog

Muoto perustuu [Keep a Changelogiin](https://keepachangelog.com/fi/1.0.0/), ja versiointi noudattaa [Semantic Versioningia](https://semver.org/lang/fi/).

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
