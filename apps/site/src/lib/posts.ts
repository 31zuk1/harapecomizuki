interface PublishedPostFrontmatter {
  title: string;
  tags?: string[];
  authorName: string;
  authorId: string;
  sourceMessageId: string;
  sourceChannelId: string;
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
    sourceMessageId: string;
    sourceChannelId: string;
    status: string;
    hasUnpublishedChanges: boolean;
    draftUpdatedAt: string;
    publishedAt: string | null;
    attachments: string[];
  };
}

const postModules = import.meta.glob('../posts/*.md', { eager: true }) as Record<string, MarkdownPostModule>;

function normalizeFrontmatter(frontmatter: PublishedPostFrontmatter): PublishedPost['data'] {
  return {
    title: frontmatter.title,
    tags: frontmatter.tags ?? [],
    authorName: frontmatter.authorName,
    authorId: frontmatter.authorId,
    sourceMessageId: frontmatter.sourceMessageId,
    sourceChannelId: frontmatter.sourceChannelId,
    status: frontmatter.status,
    hasUnpublishedChanges: frontmatter.hasUnpublishedChanges ?? false,
    draftUpdatedAt: frontmatter.draftUpdatedAt,
    publishedAt: frontmatter.publishedAt,
    attachments: frontmatter.attachments ?? []
  };
}

function slugFromModulePath(modulePath: string): string {
  return modulePath.split('/').at(-1)?.replace(/\.md$/, '') ?? modulePath;
}

export function getPublishedPosts(): PublishedPost[] {
  return Object.entries(postModules)
    .map(([modulePath, module]) => ({
      slug: slugFromModulePath(modulePath),
      file: module.file,
      Content: module.Content,
      data: normalizeFrontmatter(module.frontmatter)
    }))
    .sort((left, right) => {
      const leftDate = new Date(left.data.publishedAt ?? left.data.draftUpdatedAt).getTime();
      const rightDate = new Date(right.data.publishedAt ?? right.data.draftUpdatedAt).getTime();
      return rightDate - leftDate;
    });
}

export function getPublishedPostBySlug(slug: string): PublishedPost | undefined {
  return getPublishedPosts().find((post) => post.slug === slug);
}
