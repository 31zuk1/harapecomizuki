export interface StoredAttachment {
  originalName: string;
  storedRelativePath: string;
  publicUrl: string;
  contentType: string | null;
}

export type PostStatus = 'draft' | 'published' | 'unpublished';

export interface RegistryPost {
  messageId: string;
  channelId: string;
  slug: string;
  title: string;
  tags: string[];
  body: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  status: PostStatus;
  hasUnpublishedChanges: boolean;
  attachments: StoredAttachment[];
  publishedAttachments?: StoredAttachment[];
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
  avatarUrl?: string | null;
}

export interface IncomingAttachment {
  name: string;
  url?: string;
  sourcePath?: string;
  contentType?: string | null;
  size?: number | null;
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
  | { kind: 'help'; verbose: boolean }
  | { kind: 'publish'; slug: string }
  | { kind: 'republish'; slug: string }
  | { kind: 'unpublish'; slug: string }
  | { kind: 'status'; slug: string }
  | { kind: 'preview'; slug: string }
  | { kind: 'drafts'; limit: number }
  | { kind: 'recent'; limit: number }
  | { kind: 'cleanupUploads' }
  | { kind: 'post'; payload: PostPayload }
  | { kind: 'error'; message: string };

export interface CommandResponse {
  ok: boolean;
  message: string;
  slug?: string;
}

export type GitAutomationStatus = 'disabled' | 'skipped' | 'no_changes' | 'committed' | 'pushed' | 'failed';

export type GitAutomationStep = 'precheck' | 'add' | 'commit' | 'push';

export type GitAutomationErrorCode =
  | 'disabled'
  | 'auto_commit_required'
  | 'not_a_repo'
  | 'no_remote'
  | 'add_failed'
  | 'no_changes'
  | 'commit_failed'
  | 'push_failed'
  | 'push_rejected'
  | 'auth_failed'
  | 'unknown';

export interface GitAutomationStepResult {
  step: GitAutomationStep;
  ok: boolean;
  code: GitAutomationErrorCode | 'ok';
  summary: string;
  detail?: string | null;
}

export interface GitAutomationResult {
  status: GitAutomationStatus;
  steps: GitAutomationStepResult[];
  branch?: string | null;
  remote?: string | null;
  commitSha?: string | null;
  errorCode?: GitAutomationErrorCode | null;
  errorMessage?: string | null;
  happenedAt: string;
}

export type DeploymentState =
  | 'not_applicable'
  | 'not_configured'
  | 'queued'
  | 'in_progress'
  | 'success'
  | 'failed'
  | 'unknown';

export interface DeploymentStatus {
  state: DeploymentState;
  checkedAt: string;
  commitSha?: string | null;
  workflowName?: string | null;
  workflowRunId?: number | null;
  workflowRunUrl?: string | null;
  detail?: string | null;
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
  githubRepo?: string;
  githubToken?: string;
  githubPagesWorkflowName?: string;
  attachmentMaxSizeBytes: number;
  draftsDir: string;
  publishedDir: string;
  uploadsDir: string;
  registryFile: string;
  siteDir: string;
}
