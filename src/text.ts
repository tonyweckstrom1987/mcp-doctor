const MAX_MESSAGE = 300;

/**
 * Siivoaa palvelimelta tulevan tekstin tulostettavaksi: ohjausmerkit (rivinvaihto, ESC jne.) muuttuvat
 * välilyönneiksi ja tyhjät tiivistetään. Näin palvelimen teksti ei voi aloittaa uutta riviä
 * (esim. GitHub Actionsin `::warning::`-komento) eikä lähettää terminaalille escape-sekvenssejä.
 */
export function clean(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kuten clean, mutta lyhentää yli 300 merkin tekstin. */
export function short(text: string): string {
  const one = clean(text);
  return one.length > MAX_MESSAGE ? one.slice(0, MAX_MESSAGE) + "…" : one;
}
