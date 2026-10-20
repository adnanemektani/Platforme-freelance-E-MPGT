import { describe, expect, it } from 'vitest';
import { parseExperienceHeading, parseGammaProfiles, parsePeriod } from './gamma-parser.js';
import { sampleSnapshot } from '../../../test/fixtures/gamma-fixture.js';

describe('analyse de la page des profils historiques', () => {
  const result = parseGammaProfiles(sampleSnapshot());

  it('découpe les profils sur les blocs « Contactez nous » et ignore l’introduction', () => {
    expect(result.blocks).toBe(4);
    expect(result.skipped).toBe(1);
    expect(result.profiles.map((p) => p.externalKey)).toEqual(['profilA00000001', 'profilB00000001']);
    expect(result.profiles[0]!.parsed.sourceBlockIds).toEqual(['profilA00000001', 'profilA00000002']);
  });

  it('extrait uniquement les informations présentes', () => {
    const a = result.profiles[0]!.parsed;
    expect(a.headline).toBe('Ingénieur Travaux TCE (fictif)');
    expect(a.tagline).toBe("12 ans d'expérience | Pilotage TCE | Réhabilitation");
    expect(a.summary).toMatch(/réhabilitation de bureaux/);
    expect(a.experiences).toHaveLength(2);
    expect(a.experiences[0]).toMatchObject({ title: 'Ingénieur Travaux', organization: 'ENTREPRISE FICTIVE', startYear: 2021, startMonth: 3, isCurrent: true });
    expect(a.experiences[1]).toMatchObject({ title: 'Conducteur de travaux', organization: 'AUTRE SOCIÉTÉ FICTIVE', startYear: 2015, endYear: 2021 });
    expect(a.skills.map((s) => [s.name, s.category])).toEqual([
      ['Planification', 'TECHNICAL'],
      ['AutoCAD', 'SOFTWARE'],
      ['REVIT', 'SOFTWARE'],
      ['MS Project', 'SOFTWARE'],
    ]);
    expect(a.educations).toEqual([{ title: "Diplôme d'ingénieur", institution: 'École Fictive', periodLabel: '2014', year: 2014 }]);
    expect(a.languages).toEqual([{ name: 'Anglais', level: 'courant' }]);
  });

  it("n'importe jamais les notes masquées, l'identité ni les rubriques personnelles", () => {
    const a = result.profiles[0]!;
    expect(a.rawText).not.toContain('NOTE PRIVÉE');
    expect(JSON.stringify(a.parsed)).not.toContain('06 00 00 00 00');
    expect(JSON.stringify(a.parsed)).not.toContain('Randonnée');
    expect(a.warnings.some((w) => w.includes("Centres d'intérêt"))).toBe(true);
    const b = result.profiles[1]!;
    expect(b.parsed.headline).toBe('Économiste de la construction (fictif)');
    expect(JSON.stringify(b.parsed)).not.toContain('NOMFICTIF');
    expect(b.warnings.some((w) => w.includes('identité'))).toBe(true);
    // Rien n'est déduit : aucun champ de disponibilité, tarif, statut, consentement ou photo.
    for (const key of ['availability', 'availabilityStatus', 'rate', 'rateMin', 'businessStatus', 'consent', 'email', 'photo']) {
      expect(b.parsed).not.toHaveProperty(key);
    }
  });

  it('produit une empreinte stable (réexécution) et sensible au contenu', () => {
    const again = parseGammaProfiles(sampleSnapshot());
    expect(again.profiles.map((p) => p.fingerprint)).toEqual(result.profiles.map((p) => p.fingerprint));
    const changed = parseGammaProfiles(sampleSnapshot({ secondSummary: 'Résumé modifié à la source.' }));
    expect(changed.profiles[0]!.fingerprint).toBe(result.profiles[0]!.fingerprint);
    expect(changed.profiles[1]!.fingerprint).not.toBe(result.profiles[1]!.fingerprint);
  });

  it('lit les périodes sans rien inventer', () => {
    expect(parsePeriod('10/2016 – 12/2017')).toMatchObject({ startYear: 2016, startMonth: 10, endYear: 2017, endMonth: 12, isCurrent: false });
    expect(parsePeriod('Depuis janvier 2018')).toMatchObject({ startYear: 2018, startMonth: 1, isCurrent: true });
    expect(parsePeriod('2019 - 2024')).toMatchObject({ startYear: 2019, startMonth: null, endYear: 2024 });
    // Intitulé ambigu : aucune séparation poste / organisation n'est inventée.
    expect(parseExperienceHeading('Consultant - Responsable technique (2023-2025)')).toMatchObject({ title: 'Consultant - Responsable technique', organization: null });
  });

  it('refuse une page sans données Gamma', () => {
    expect(() => parseGammaProfiles('<html><body>rien</body></html>')).toThrow(/Structure de page inattendue/);
  });
});
