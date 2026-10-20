// Générateur d'instantanés FICTIFS au format de la page Gamma (tests uniquement).
// Aucune donnée réelle : les profils ci-dessous sont inventés pour les tests.

type Node = { type: string; text?: string; attrs?: Record<string, unknown>; content?: Node[] };

const text = (value: string): Node => ({ type: 'text', text: value });
export const h = (level: number, value: string): Node => ({ type: 'heading', attrs: { level }, content: [text(value)] });
export const p = (value: string): Node => ({ type: 'paragraph', content: [text(value)] });
export const li = (value: string): Node => ({ type: 'bullet', content: [p(value)] });
export const contactButton: Node = {
  type: 'buttonGroup',
  content: [{ type: 'button', attrs: { href: 'https://gamma.app/docs/Nous-Contacter-BTP-test' }, content: [text('Contactez nous')] }],
};
export const notes = (value: string): Node => ({ type: 'cardNotes', content: [p(value)] });

export function card(id: string, nodes: Node[]): Node {
  return { type: 'card', attrs: { id }, content: [{ type: 'cardLayoutItem', content: nodes }] };
}

export function gammaHtml(cards: Node[]): string {
  const data = {
    props: { pageProps: { page: { publishedSnapshot: { content: { default: { content: [{ type: 'document', content: cards }] } } } } } },
  };
  return `<!doctype html><html><head><title>Profils fictifs</title></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}

/** Instantané de référence : une introduction, un profil sur deux blocs, un profil précédé d'un nom. */
export function sampleSnapshot(overrides: { secondSummary?: string } = {}): string {
  return gammaHtml([
    card('intro0000000001', [h(1, 'Profils fictifs de test'), p('Introduction sans bouton de contact : ignorée.')]),
    card('profilA00000001', [
      h(1, 'Ingénieur Travaux TCE (fictif)'),
      contactButton,
      p("12 ans d'expérience | Pilotage TCE | Réhabilitation"),
      h(3, 'Profil'),
      p('Ingénieur travaux fictif spécialisé en réhabilitation de bureaux en site occupé.'),
      h(3, 'Expériences professionnelles'),
      h(4, 'ENTREPRISE FICTIVE - Ingénieur Travaux (03/2021-en cours)'),
      p('Pilotage des lots secondaires.'),
      h(4, '2015 – 2021 : Conducteur de travaux – AUTRE SOCIÉTÉ FICTIVE'),
      li('Encadrement de 3 chefs de chantier'),
      h(3, 'Compétences'),
      li('Planification'),
      li('AutoCAD, REVIT, MS Project'),
      notes('NOTE PRIVÉE : téléphone 06 00 00 00 00 — ne doit jamais être importée'),
    ]),
    card('profilA00000002', [
      h(3, 'Formation et Langues'),
      li("2014 : Diplôme d'ingénieur – École Fictive"),
      li('Anglais (courant)'),
      h(4, "Centres d'intérêt"),
      li('Randonnée'),
    ]),
    card('profilB00000001', [
      h(3, 'Prénom NOMFICTIF'),
      h(2, 'Économiste de la construction (fictif)'),
      contactButton,
      h(3, 'Profil'),
      p(overrides.secondSummary ?? 'Économiste fictif : métrés, DPGF et suivi financier de chantiers de logements.'),
      h(3, 'Compétences'),
      li('Métrés'),
      li('DPGF'),
      h(3, 'Langues'),
      li('Français : langue maternelle'),
    ]),
  ]);
}
