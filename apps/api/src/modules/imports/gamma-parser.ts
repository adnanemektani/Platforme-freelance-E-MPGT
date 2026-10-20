import type { ParsedProfile, ParsedProfileExperience, SkillCategory } from '@empgt/contracts';
import { canonicalJson, sha256Hex } from '../../common/crypto.js';
import { normalizeForCompare } from '../../common/text.js';

// Analyse déterministe de la page publique « profils disponibles » (site publié avec Gamma).
//
// Principes (cahier des charges §5) :
// - seules les informations présentes sont extraites (titre, résumé, expériences, compétences,
//   formations, langues) ; tout le reste est nul ou « à confirmer » ;
// - jamais d'identité, d'e-mail, de statut, de disponibilité, de tarif, de qualification vérifiée
//   ni de consentement ; les intitulés pouvant désigner une personne sont ignorés et signalés ;
// - les notes de présentation masquées (cardNotes) et les images ne sont jamais importées ;
// - le découpage est stable : un profil commence sur un bloc portant le bouton « Contactez nous »,
//   les blocs suivants sans bouton en sont la suite ; la clé externe est l'identifiant du premier bloc.

export const PARSER_VERSION = 'gamma-profils-1.0.0';

interface GammaNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: GammaNode[];
}

type Line = { kind: 'heading'; level: number; text: string } | { kind: 'paragraph'; text: string } | { kind: 'bullet'; text: string } | { kind: 'button'; text: string; href: string };

export interface ParsedBlock {
  externalKey: string;
  parsed: ParsedProfile;
  rawText: string;
  warnings: string[];
  fingerprint: string;
}

export interface ParseResult {
  blocks: number;
  profiles: ParsedBlock[];
  skipped: number;
  warnings: string[];
}

// ── Extraction du document Gamma ────────────────────────────────────────────

export function extractGammaDocument(html: string): GammaNode {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('Structure de page inattendue : données __NEXT_DATA__ absentes');
  const data = JSON.parse(match[1]!) as {
    props?: { pageProps?: { page?: { publishedSnapshot?: { content?: { default?: { content?: GammaNode[] } } } } } };
  };
  const root = data.props?.pageProps?.page?.publishedSnapshot?.content?.default?.content?.[0];
  if (!root || root.type !== 'document') throw new Error('Structure de page inattendue : document Gamma introuvable');
  return root;
}

function textOf(node: GammaNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return ' ';
  if (node.type === 'cardNotes') return '';
  return (node.content ?? []).map(textOf).join('');
}

function clean(value: string): string {
  return value.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function linesOf(node: GammaNode, out: Line[] = []): Line[] {
  switch (node.type) {
    case 'cardNotes':
      return out; // notes masquées : jamais importées
    case 'heading': {
      const text = clean(textOf(node));
      if (text) out.push({ kind: 'heading', level: Number(node.attrs?.level ?? 3), text });
      return out;
    }
    case 'paragraph': {
      const text = clean(textOf(node));
      if (text) out.push({ kind: 'paragraph', text });
      return out;
    }
    case 'bullet': {
      // Un élément de liste peut contenir plusieurs paragraphes : on garde une ligne par élément.
      const text = clean((node.content ?? []).map((c) => textOf(c)).join(' '));
      if (text) out.push({ kind: 'bullet', text });
      return out;
    }
    case 'button': {
      out.push({ kind: 'button', text: clean(textOf(node)), href: typeof node.attrs?.href === 'string' ? node.attrs.href : '' });
      return out;
    }
    case 'image':
    case 'video':
    case 'embed':
      return out; // aucune image n'est importée (pas de photo personnelle déduite)
    default:
      for (const child of node.content ?? []) linesOf(child, out);
      return out;
  }
}

// ── Classification des sections ─────────────────────────────────────────────

type Section = 'summary' | 'experiences' | 'skills' | 'educations' | 'languages' | 'mixed_education_languages' | 'excluded' | 'unknown';

/** Une date dans un intitulé indique une expérience, jamais un titre de section. */
const HAS_DATE = /\b(19|20)\d{2}\b|\b\d{1,2}\/\d{2,4}\b/;

function sectionOf(heading: string): { section: Section; category?: SkillCategory } | null {
  if (HAS_DATE.test(heading)) return null;
  const h = normalizeForCompare(heading);
  if (/^(profil|resume|a propos|presentation|objectif|synthese)\b/.test(h)) return { section: 'summary' };
  if (/^(experiences?|parcours|projets?( majeurs?| realises)?|references?|realisations?|missions? (realisees|significatives))\b/.test(h)) return { section: 'experiences' };
  if (/^(formations? et langues?|langues? et formations?)\b/.test(h)) return { section: 'mixed_education_languages' };
  if (/^langues?\b/.test(h)) return { section: 'languages' };
  if (/^(formations?|autres formations?|diplomes?|etudes|cursus|certifications?|certificats?|licences? et certifications?|normes et habilitations|habilitations?)\b/.test(h)) {
    return { section: 'educations' };
  }
  if (/^(logiciels?|outils|competences informatiques?|connaissances informatiques?|informatique|maitrise des logiciels)\b/.test(h)) {
    return { section: 'skills', category: 'SOFTWARE' };
  }
  if (/^(management|soft skills|qualites|savoir etre)\b/.test(h)) return { section: 'skills', category: h.startsWith('management') ? 'MANAGEMENT' : 'OTHER' };
  if (/^((domaines?|secteurs?) (d|de|des) (competences|expertise|intervention|activite)|specialites?|expertises?)\b/.test(h)) {
    return { section: 'skills', category: 'DOMAIN' };
  }
  if (/^competences?\b/.test(h)) return { section: 'skills', category: 'TECHNICAL' };
  // Rubriques personnelles ou hors périmètre de l'import : volontairement non importées.
  if (/^(centres? d interets?|interets?|domaines? d interets?|loisirs|hobbies|divers|permis|localisation|adresse|contact|affiliations?|pays des missions|nationalite|age|etat civil)\b/.test(h)) {
    return { section: 'excluded' };
  }
  return null;
}

const LANGUAGES = [
  'francais', 'anglais', 'espagnol', 'italien', 'portugais', 'arabe', 'allemand', 'neerlandais', 'russe', 'chinois',
  'mandarin', 'japonais', 'turc', 'polonais', 'roumain', 'wolof', 'berbere', 'amazigh', 'tamazight', 'lingala', 'bambara',
];

const SOFTWARE_HINTS = [
  'autocad', 'revit', 'sketchup', 'archicad', 'tekla', 'robot', 'matlab', 'covadis', 'mensura', 'civil 3d', 'navisworks',
  'ms project', 'microsoft project', 'primavera', 'excel', 'pack office', 'office', 'bim', 'allplan', 'solidworks', 'qgis', 'arcgis',
];

function isLanguageName(value: string): boolean {
  const n = normalizeForCompare(value);
  return LANGUAGES.some((l) => n === l || n.startsWith(`${l} `));
}

function splitOutsideParentheses(value: string, separator = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// ── Lecture des périodes (texte conservé tel quel ; années et mois si explicites) ─

const JOB_TITLE =
  /\b(ingenieur|conducteur|chef|directeur|direction|responsable|manager|charge|chargee|consultant|consultante|assistant|assistante|stagiaire|stage|technicien|dessinateur|projeteur|geometre|economiste|coordinateur|coordinatrice|superviseur|superintendant|president|gerant|pilote|opc|moe|moex|amo|bim|controleur|inspecteur|metreur|architecte|apprenti|alternant|expert|auditeur|planificateur|tuyauteur|soudeur|electricien|plombier|formateur|surveyor|officer|analyste|gestionnaire|agent|operateur|surintendant|lead|engineer)\b/;

const ABBREVIATIONS: Record<string, string> = {
  janv: 'janvier', fevr: 'fevrier', fev: 'fevrier', avr: 'avril', juil: 'juillet', sept: 'septembre', oct: 'octobre', nov: 'novembre', dec: 'decembre',
};

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

function parsePoint(value: string): { year: number | null; month: number | null } {
  const v = normalizeForCompare(value);
  let m = /(\d{1,2}) (\d{4})/.exec(v); // 03 2024 (issu de 03/2024)
  if (m) return { month: Number(m[1]), year: Number(m[2]) };
  m = /(\d{1,2}) (\d{2})\b/.exec(v); // 03 24
  if (m && Number(m[1]) <= 12) return { month: Number(m[1]), year: 2000 + Number(m[2]) };
  m = /(janvier|janv|fevrier|fevr|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec) (\d{4})/.exec(v);
  if (m) return { month: MONTHS[m[1]!] ?? MONTHS[ABBREVIATIONS[m[1]!] ?? ''] ?? null, year: Number(m[2]) };
  m = /\b(19|20)(\d{2})\b/.exec(v);
  if (m) return { month: null, year: Number(`${m[1]}${m[2]}`) };
  return { year: null, month: null };
}

const PERIOD = /((?:depuis|des|de)\s+)?((?:\d{1,2}\/)?(?:\d{4}|\d{2})|(?:janv\.?|janvier|févr\.?|février|fevrier|mars|avr\.?|avril|mai|juin|juil\.?|juillet|août|aout|sept\.?|septembre|oct\.?|octobre|nov\.?|novembre|déc\.?|décembre|decembre)\s+\d{4})\s*(?:[-–—à]|au)?\s*((?:\d{1,2}\/)?(?:\d{4}|\d{2})|en cours|actuel|aujourd'hui|…|\.\.\.)?/i;

export function parsePeriod(label: string): Pick<ParsedProfileExperience, 'startYear' | 'startMonth' | 'endYear' | 'endMonth' | 'isCurrent'> {
  const normalized = label.replace(/\s+/g, ' ').trim();
  const isCurrent = /(depuis|en cours|actuel|aujourd'hui|…|\.\.\.\s*$|-\s*\.\.\.|–\s*…)/i.test(normalized);
  const [startRaw, endRaw] = normalized.split(/\s*(?:[-–—]|\bà\b|\bau\b)\s*/i);
  const start = parsePoint(startRaw ?? '');
  const end = endRaw && !/(en cours|actuel|aujourd|…|\.\.\.)/i.test(endRaw) ? parsePoint(endRaw) : { year: null, month: null };
  return { startYear: start.year, startMonth: start.month, endYear: end.year, endMonth: end.month, isCurrent };
}

/** Sépare « période : intitulé – organisation » ou « Organisation - Poste (période) ». */
export function parseExperienceHeading(heading: string): Omit<ParsedProfileExperience, 'description'> {
  let text = heading.trim();
  let periodLabel: string | null = null;
  // Période en tête : « 10/2016 – 12/2017 : … », « Depuis janvier 2018 : … », « 2023-2025: … »
  const lead = /^((?:depuis\s+)?[^:]{0,40}?\d{2,4}[^:]{0,25}?)\s*:\s*(.+)$/i.exec(text);
  if (lead && /\d/.test(lead[1]!) && PERIOD.test(lead[1]!)) {
    periodLabel = lead[1]!.trim();
    text = lead[2]!.trim();
  } else {
    // Période entre parenthèses en fin : « … (03/2024-en cours) »
    const trail = /^(.*?)\s*\(([^()]*\d{2,4}[^()]*)\)\s*$/.exec(text);
    if (trail && PERIOD.test(trail[2]!)) {
      periodLabel = trail[2]!.trim();
      text = trail[1]!.trim();
    }
  }
  let title = text;
  let organization: string | null = null;
  const dash = text.split(/\s+[–—-]\s+/);
  if (dash.length >= 2) {
    const [first, ...rest] = dash;
    const second = rest.join(' – ');
    // Le poste est la partie qui contient un intitulé de fonction ; en cas de doute, rien n'est séparé.
    const firstIsJob = JOB_TITLE.test(normalizeForCompare(first!));
    const secondIsJob = JOB_TITLE.test(normalizeForCompare(second));
    if (firstIsJob && !secondIsJob) {
      title = first!.trim();
      organization = second.trim();
    } else if (secondIsJob && !firstIsJob) {
      title = second.trim();
      organization = first!.trim();
    }
  }
  const period = periodLabel ? parsePeriod(periodLabel) : { startYear: null, startMonth: null, endYear: null, endMonth: null, isCurrent: false };
  return { title: title.slice(0, 200), organization: organization?.slice(0, 200) ?? null, periodLabel, ...period };
}

function parseEducation(line: string): { title: string; institution: string | null; periodLabel: string | null; year: number | null } {
  let text = line.trim();
  let periodLabel: string | null = null;
  const lead = /^(\d{4}(?:\s*[-–—]\s*\d{4})?)\s*:\s*(.+)$/.exec(text);
  if (lead) {
    periodLabel = lead[1]!;
    text = lead[2]!;
  }
  let title = text;
  let institution: string | null = null;
  const parts = splitOutsideParentheses(text.replace(/\s+[–—]\s+/g, ' – '), '–');
  if (parts.length >= 2) {
    title = parts.slice(0, -1).join(' – ');
    institution = parts.at(-1)!;
  } else {
    const dash = /^(.*?)\s+-\s+(.+)$/.exec(text);
    if (dash) {
      title = dash[1]!;
      institution = dash[2]!;
    }
  }
  const years = periodLabel?.match(/\d{4}/g) ?? [];
  return { title: title.trim().slice(0, 300), institution: institution?.trim().slice(0, 200) ?? null, periodLabel, year: years.length ? Number(years.at(-1)) : null };
}

function parseLanguages(line: string, warnings: string[]): Array<{ name: string; level: string | null }> {
  // « Anglais : courant écrit et parlé »
  const colon = /^([^:]+):\s*(.+)$/.exec(line);
  if (colon && isLanguageName(colon[1]!)) return [{ name: colon[1]!.trim(), level: colon[2]!.trim() }];
  // « Français, Anglais, Arabe (fluide) » ou « Espagnol (intermédiaire) »
  const trailing = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(line);
  const namesPart = trailing ? trailing[1]! : line;
  const level = trailing ? trailing[2]!.trim() : null;
  const names = splitOutsideParentheses(namesPart).filter(isLanguageName);
  if (names.length === 0) return [];
  if (names.length > 1 && level) warnings.push(`Niveau « ${level} » appliqué à plusieurs langues (${names.join(', ')}) : à confirmer`);
  return names.map((name) => ({ name: name.replace(/\s*\(.*\)$/, '').trim(), level }));
}

function skillItems(line: string, category: SkillCategory): Array<{ name: string; category: SkillCategory }> {
  const parts = splitOutsideParentheses(line);
  const list = parts.length > 1 && parts.every((p) => p.length <= 30) ? parts : [line];
  return list.map((name) => {
    const n = normalizeForCompare(name);
    const software = category === 'SOFTWARE' || SOFTWARE_HINTS.some((hint) => n === hint || n.startsWith(`${hint} `) || n.endsWith(` ${hint}`));
    return { name: name.trim(), category: software ? 'SOFTWARE' : category };
  });
}

// ── Assemblage d'un profil ──────────────────────────────────────────────────

function isContactButton(line: Line): boolean {
  return line.kind === 'button' && /contact/i.test(line.text) && /contact/i.test(line.href);
}

function buildProfile(cards: Array<{ id: string; lines: Line[] }>): ParsedBlock {
  const warnings: string[] = [];
  const lines = cards.flatMap((c) => c.lines).filter((l) => l.kind !== 'button');
  const parsed: ParsedProfile = {
    headline: null,
    tagline: null,
    summary: null,
    experiences: [],
    skills: [],
    educations: [],
    languages: [],
    qualificationMentions: [],
    sourceBlockIds: cards.map((c) => c.id),
  };

  // Titre : premier H1, sinon premier H2 ; les intitulés de niveau inférieur qui le précèdent
  // (ex. un nom de personne) sont ignorés.
  const firstLines = cards[0]!.lines.filter((l) => l.kind !== 'button');
  const headlineIndex = (() => {
    const h1 = firstLines.findIndex((l) => l.kind === 'heading' && l.level === 1);
    if (h1 >= 0) return h1;
    return firstLines.findIndex((l) => l.kind === 'heading' && l.level === 2);
  })();
  if (headlineIndex >= 0) {
    parsed.headline = (firstLines[headlineIndex] as { text: string }).text.slice(0, 200);
    if (firstLines.slice(0, headlineIndex).some((l) => l.kind === 'heading')) {
      warnings.push('Un intitulé précédant le titre (susceptible de désigner une personne) a été ignoré : l’identité n’est jamais importée.');
    }
    const next = firstLines[headlineIndex + 1];
    if (next?.kind === 'paragraph') parsed.tagline = next.text.slice(0, 500);
  } else {
    warnings.push('Titre de profil introuvable');
  }

  const startIndex = lines.indexOf(firstLines[headlineIndex]!) + (parsed.tagline ? 2 : 1);
  let section: Section | null = null;
  let category: SkillCategory = 'TECHNICAL';
  let currentExperience: ParsedProfileExperience | null = null;
  const summary: string[] = [];
  const unknownSections = new Set<string>();
  const excludedSections = new Set<string>();

  const pushExperienceText = (text: string) => {
    if (!currentExperience) return;
    currentExperience.description = currentExperience.description ? `${currentExperience.description}\n${text}` : text;
  };

  for (const line of lines.slice(Math.max(startIndex, 0))) {
    if (line.kind === 'heading') {
      const s = sectionOf(line.text.replace(/:\s*$/, ''));
      if (s) {
        if (s.section === 'excluded') excludedSections.add(line.text.replace(/:\s*$/, ''));
        section = s.section;
        category = s.category ?? 'TECHNICAL';
        currentExperience = null;
        continue;
      }
      // Un intitulé daté (ou placé sous « expériences ») ouvre une expérience, quelle que soit la section courante.
      const dated = HAS_DATE.test(line.text) && line.level >= 3;
      if (dated || (section === 'experiences' && line.level >= 3)) {
        section = 'experiences';
        currentExperience = { ...parseExperienceHeading(line.text), description: null };
        parsed.experiences.push(currentExperience);
        continue;
      }
      if (line.level <= 2 && /competences|formation/i.test(normalizeForCompare(line.text))) {
        section = null; // titre de regroupement (« Compétences & Formation ») : les sous-titres précisent
        continue;
      }
      if (!parsed.tagline && /\bans d.?exp/i.test(line.text)) {
        parsed.tagline = line.text.slice(0, 500);
        continue;
      }
      section = 'unknown';
      unknownSections.add(line.text);
      continue;
    }

    const text = line.text;
    switch (section) {
      case 'summary':
        summary.push(text);
        break;
      case 'experiences':
        if (currentExperience) pushExperienceText(line.kind === 'bullet' ? `• ${text}` : text);
        else summary.push(text);
        break;
      case 'skills':
        for (const item of skillItems(text, category)) {
          if (item.name.length > 100) warnings.push(`Compétence trop longue non importée : « ${item.name.slice(0, 60)}… »`);
          else parsed.skills.push(item);
        }
        break;
      case 'languages':
        parsed.languages.push(...parseLanguages(text, warnings));
        break;
      case 'educations':
        parsed.educations.push(parseEducation(text));
        if (/certif|pmp|prince2|hqe|breeam|caces|habilitation/i.test(text)) parsed.qualificationMentions.push(text);
        break;
      case 'mixed_education_languages': {
        const langs = parseLanguages(text, warnings);
        if (langs.length) parsed.languages.push(...langs);
        else parsed.educations.push(parseEducation(text));
        break;
      }
      case 'unknown':
      case 'excluded':
        break;
      default:
        // Texte libre avant toute section : rattaché au résumé (ex. paragraphe d'introduction).
        if (currentExperience) pushExperienceText(text);
        else summary.push(text);
    }
  }

  parsed.summary = summary.length ? summary.join('\n').slice(0, 5000) : null;
  for (const name of unknownSections) warnings.push(`Section non reconnue « ${name} » : non importée`);
  for (const name of excludedSections) warnings.push(`Rubrique « ${name} » volontairement non importée (donnée personnelle ou hors périmètre)`);
  // Dédoublonnage des compétences (forme normalisée).
  const seen = new Set<string>();
  parsed.skills = parsed.skills.filter((s) => {
    const key = normalizeForCompare(s.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  parsed.experiences = parsed.experiences.map((e) => ({ ...e, description: e.description?.slice(0, 5000) ?? null }));
  if (!parsed.summary) warnings.push('Résumé absent de la source');
  if (parsed.skills.length === 0) warnings.push('Aucune compétence identifiée');

  const rawText = cards
    .flatMap((c) => c.lines)
    .map((l) => (l.kind === 'heading' ? `${'#'.repeat(Math.min(l.level, 4))} ${l.text}` : l.kind === 'bullet' ? `- ${l.text}` : l.kind === 'button' ? `[${l.text}]` : l.text))
    .join('\n');
  const { sourceBlockIds: _ids, ...content } = parsed;
  void _ids;
  return {
    externalKey: cards[0]!.id,
    parsed,
    rawText,
    warnings,
    fingerprint: sha256Hex(canonicalJson(content)),
  };
}

export function parseGammaProfiles(html: string): ParseResult {
  const root = extractGammaDocument(html);
  const cards = (root.content ?? []).filter((c) => c.type === 'card').map((card) => ({ id: typeof card.attrs?.id === 'string' ? card.attrs.id : '', lines: linesOf(card) }));
  const groups: Array<Array<{ id: string; lines: Line[] }>> = [];
  let skipped = 0;
  for (const card of cards) {
    if (!card.id) {
      skipped++;
      continue;
    }
    if (card.lines.some(isContactButton)) groups.push([card]);
    else if (groups.length) groups.at(-1)!.push(card);
    else skipped++; // bloc d'introduction avant le premier profil
  }
  const profiles = groups.map(buildProfile);
  return { blocks: cards.length, profiles, skipped, warnings: [] };
}
