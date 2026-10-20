import { Injectable } from '@nestjs/common';
import type { SkillCategory, SkillSuggestion } from '@empgt/contracts';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { slugify } from '../../common/text.js';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Retrouve ou crée les compétences (unicité par forme normalisée). */
  async resolve(db: Db, items: Array<{ name: string; category: SkillCategory }>): Promise<Map<string, string>> {
    const bySlug = new Map<string, { name: string; category: SkillCategory }>();
    for (const item of items) {
      const slug = slugify(item.name);
      if (slug && !bySlug.has(slug)) bySlug.set(slug, { name: item.name.trim(), category: item.category });
    }
    const result = new Map<string, string>();
    for (const [slug, item] of bySlug) {
      const skill = await db.skill.upsert({
        where: { slug },
        create: { slug, name: item.name, category: item.category },
        update: {},
        select: { id: true },
      });
      result.set(slug, skill.id);
    }
    return result;
  }

  async suggest(q: string | undefined, limit = 15): Promise<SkillSuggestion[]> {
    const slug = q ? slugify(q) : '';
    const skills = await this.prisma.skill.findMany({
      where: slug ? { OR: [{ slug: { contains: slug } }, { name: { contains: q!, mode: 'insensitive' } }] } : {},
      orderBy: [{ freelancers: { _count: 'desc' } }, { name: 'asc' }],
      take: limit,
    });
    return skills.map((s) => ({ id: s.id, name: s.name, category: s.category }));
  }
}
