interface PublishedPostFrontmatter {
  title: string;
  tags?: string[];
  authorName: string;
  authorId: string;
  authorAvatarUrl?: string | null;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceCreatedAt?: string;
  sourceUpdatedAt?: string;
  status: string;
  hasUnpublishedChanges?: boolean;
  draftUpdatedAt: string;
  publishedAt: string | null;
  attachments?: string[];
}

interface MarkdownPostModule {
  Content: unknown;
  file: string;
  frontmatter: PublishedPostFrontmatter;
  rawContent: () => string;
}

export interface PublishedPost {
  slug: string;
  file: string;
  Content: MarkdownPostModule['Content'];
  data: {
    title: string;
    tags: string[];
    authorName: string;
    authorId: string;
    authorAvatarUrl: string | null;
    sourceMessageId: string;
    sourceChannelId: string;
    sourceCreatedAt: string | null;
    sourceUpdatedAt: string | null;
    status: string;
    hasUnpublishedChanges: boolean;
    draftUpdatedAt: string;
    publishedAt: string | null;
    attachments: string[];
    excerpt: string;
  };
}

export interface PublishedPostRelation {
  id: string;
  sourceSlug: string;
  targetSlug: string;
  score: number;
  reasons: string[];
  sharedTags: string[];
  sameAuthor: boolean;
}

export interface PublishedPostRelationSummary {
  slug: string;
  title: string;
  score: number;
  reasons: string[];
  sharedTags: string[];
  sameAuthor: boolean;
  publishedAt: string | null;
}

export interface PublishedPostGraphNode {
  slug: string;
  title: string;
  authorName: string;
  tags: string[];
  publishedAt: string | null;
  relationCount: number;
  connectionStrength: number;
  isFocus: boolean;
}

export interface PublishedPostGraph {
  nodes: PublishedPostGraphNode[];
  edges: PublishedPostRelation[];
  adjacency: Record<string, PublishedPostRelationSummary[]>;
  strongestLinks: PublishedPostRelation[];
}

const postModules = import.meta.glob('../posts/*.md', { eager: true }) as Record<string, MarkdownPostModule>;

function normalizeFrontmatter(frontmatter: PublishedPostFrontmatter): PublishedPost['data'] {
  return {
    title: frontmatter.title,
    tags: frontmatter.tags ?? [],
    authorName: frontmatter.authorName,
    authorId: frontmatter.authorId,
    authorAvatarUrl: frontmatter.authorAvatarUrl ?? null,
    sourceMessageId: frontmatter.sourceMessageId,
    sourceChannelId: frontmatter.sourceChannelId,
    sourceCreatedAt: frontmatter.sourceCreatedAt ?? null,
    sourceUpdatedAt: frontmatter.sourceUpdatedAt ?? frontmatter.draftUpdatedAt ?? null,
    status: frontmatter.status,
    hasUnpublishedChanges: frontmatter.hasUnpublishedChanges ?? false,
    draftUpdatedAt: frontmatter.draftUpdatedAt,
    publishedAt: frontmatter.publishedAt,
    attachments: frontmatter.attachments ?? [],
    excerpt: ''
  };
}

function slugFromModulePath(modulePath: string): string {
  return modulePath.split('/').at(-1)?.replace(/\.md$/, '') ?? modulePath;
}

export function getPublishedPosts(): PublishedPost[] {
  return Object.entries(postModules)
    .map(([modulePath, module]) => {
      const normalized = normalizeFrontmatter(module.frontmatter);
      const excerpt = module
        .rawContent()
        .replace(/^---[\s\S]*?---\n?/, '')
        .replace(/!\[[^\]]*]\([^)]+\)/g, '')
        .replace(/\[[^\]]+]\([^)]+\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*]\s+/gm, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);

      return {
        slug: slugFromModulePath(modulePath),
        file: module.file,
        Content: module.Content,
        data: {
          ...normalized,
          excerpt
        }
      };
    })
    .sort((left, right) => {
      const leftDate = new Date(left.data.publishedAt ?? left.data.draftUpdatedAt).getTime();
      const rightDate = new Date(right.data.publishedAt ?? right.data.draftUpdatedAt).getTime();
      return rightDate - leftDate;
    });
}

export function getPublishedPostBySlug(slug: string): PublishedPost | undefined {
  return getPublishedPosts().find((post) => post.slug === slug);
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function buildRelation(left: PublishedPost, right: PublishedPost): PublishedPostRelation | null {
  const leftTags = new Map(left.data.tags.map((tag) => [normalizeTag(tag), tag]));
  const rightTags = new Map(right.data.tags.map((tag) => [normalizeTag(tag), tag]));
  const sharedTags = [...leftTags.entries()]
    .filter(([tag]) => rightTags.has(tag))
    .map(([, originalTag]) => originalTag);
  const sameAuthor = left.data.authorId === right.data.authorId;
  const reasons: string[] = [];
  let score = 0;

  if (sharedTags.length > 0) {
    score += sharedTags.length * 3;
    reasons.push(`shared tags: ${sharedTags.join(', ')}`);
  }

  if (sameAuthor) {
    score += 2;
    reasons.push(`same author: ${left.data.authorName}`);
  }

  if (score === 0) {
    return null;
  }

  return {
    id: `${left.slug}__${right.slug}`,
    sourceSlug: left.slug,
    targetSlug: right.slug,
    score,
    reasons,
    sharedTags,
    sameAuthor
  };
}

export function getPublishedPostGraph(posts: PublishedPost[] = getPublishedPosts(), focusSlug?: string): PublishedPostGraph {
  const adjacency = Object.fromEntries(posts.map((post) => [post.slug, [] as PublishedPostRelationSummary[]]));
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const edges: PublishedPostRelation[] = [];

  for (let index = 0; index < posts.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < posts.length; compareIndex += 1) {
      const relation = buildRelation(posts[index], posts[compareIndex]);

      if (!relation) {
        continue;
      }

      edges.push(relation);

      const left = posts[index];
      const right = posts[compareIndex];

      adjacency[left.slug].push({
        slug: right.slug,
        title: right.data.title,
        score: relation.score,
        reasons: relation.reasons,
        sharedTags: relation.sharedTags,
        sameAuthor: relation.sameAuthor,
        publishedAt: right.data.publishedAt ?? right.data.draftUpdatedAt
      });

      adjacency[right.slug].push({
        slug: left.slug,
        title: left.data.title,
        score: relation.score,
        reasons: relation.reasons,
        sharedTags: relation.sharedTags,
        sameAuthor: relation.sameAuthor,
        publishedAt: left.data.publishedAt ?? left.data.draftUpdatedAt
      });
    }
  }

  for (const summaries of Object.values(adjacency)) {
    summaries.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime();
    });
  }

  const nodes = posts.map((post) => {
    const relationCount = adjacency[post.slug].length;
    const connectionStrength = adjacency[post.slug].reduce((total, relation) => total + relation.score, 0);

    return {
      slug: post.slug,
      title: post.data.title,
      authorName: post.data.authorName,
      tags: post.data.tags,
      publishedAt: post.data.publishedAt ?? post.data.draftUpdatedAt,
      relationCount,
      connectionStrength,
      isFocus: post.slug === focusSlug
    };
  });

  nodes.sort((left, right) => {
    if (left.isFocus !== right.isFocus) {
      return left.isFocus ? -1 : 1;
    }

    if (right.connectionStrength !== left.connectionStrength) {
      return right.connectionStrength - left.connectionStrength;
    }

    const rightPost = postsBySlug.get(right.slug);
    const leftPost = postsBySlug.get(left.slug);
    const rightDate = new Date(rightPost?.data.publishedAt ?? rightPost?.data.draftUpdatedAt ?? 0).getTime();
    const leftDate = new Date(leftPost?.data.publishedAt ?? leftPost?.data.draftUpdatedAt ?? 0).getTime();
    return rightDate - leftDate;
  });

  const strongestLinks = [...edges].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const rightDate = new Date(postsBySlug.get(right.targetSlug)?.data.publishedAt ?? 0).getTime();
    const leftDate = new Date(postsBySlug.get(left.targetSlug)?.data.publishedAt ?? 0).getTime();
    return rightDate - leftDate;
  });

  return {
    nodes,
    edges,
    adjacency,
    strongestLinks
  };
}
