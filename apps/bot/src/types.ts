export interface StoredAttachment {
  originalName: string;
  storedRelativePath: string;
  publicUrl: string;
  contentType: string | null;
}

export interface RegistryPost {
  messageId: string;
  channelId: string;
  slug: string;
  title: string;
  tags: string[];
  body: string;
  authorId: string;
  authorName: string;
  status: 'draft' | 'published' | 'unpublished';
  hasUnpublishedChanges: boolean;
  attachments: StoredAttachment[];
  draftFilePath: string;
  publishedFilePath: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface RegistryFile {
  posts: Record<string, RegistryPost>;
}

export interface CommandActor {
  id: string;
  name: string;
  roles: string[];
}

export interface IncomingAttachment {
  name: string;
  url?: string;
  sourcePath?: string;
  contentType?: string | null;
}

export interface IncomingMessage {
  messageId: string;
  channelId: string;
  content: string;
  actor: CommandActor;
  attachments: IncomingAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PostPayload {
  title: string;
  slug?: string;
  tags: string[];
  body: string;
}

export type ParsedCommand =
  | { kind: 'ignored' }
  | { kind: 'help' }
  | { kind: 'publish'; slug: string }
  | { kind: 'unpublish'; slug: string }
  | { kind: 'status'; slug: string }
  | { kind: 'post'; payload: PostPayload }
  | { kind: 'error'; message: string };

export interface CommandResponse {
  ok: boolean;
  message: string;
  slug?: string;
}

export interface ResolvedConfig {
  repoRoot: string;
  discordToken?: string;
  blogChannelId: string;
  publisherRoleId?: string;
  gitAutoCommit: boolean;
  gitAutoPush: boolean;
  siteBaseUrl: string;
  gitAuthorName?: string;
  gitAuthorEmail?: string;
  draftsDir: string;
  publishedDir: string;
  uploadsDir: string;
  registryFile: string;
  siteDir: string;
}
