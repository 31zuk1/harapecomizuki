import path from 'node:path';
import type {
  DeploymentStatus,
  GitAutomationResult,
  PostStatus,
  RegistryPost,
  ResolvedConfig,
  StoredAttachment
} from './types';
import { ensureTrailingSlash, isImageAttachment, renderFrontmatter } from './utils';

const PREVIEW_LINE_LIMIT = 6;

function renderAttachmentMarkdown(attachments: StoredAttachment[]): string {
  if (attachments.length === 0) {
    return '';
  }

  const blocks = attachments.map((attachment) => {
    const altText = attachment.originalName;

    if (isImageAttachment(attachment.originalName, attachment.contentType)) {
      return `![${altText}](${attachment.publicUrl})`;
    }

    return `- [${attachment.originalName}](${attachment.publicUrl})`;
  });

  return `\n\n## Attachments\n\n${blocks.join('\n\n')}\n`;
}

export function buildPublicPostUrl(config: ResolvedConfig, slug: string): string {
  return `${config.siteBaseUrl.replace(/\/$/, '')}/posts/${slug}/`;
}

export function buildMarkdown(
  post: RegistryPost,
  options: {
    publishedAtOverride?: string | null;
    hasUnpublishedChanges?: boolean;
    attachmentsOverride?: StoredAttachment[];
    statusOverride?: PostStatus;
  } = {}
): string {
  const attachments = options.attachmentsOverride ?? post.attachments;
  const frontmatter = renderFrontmatter({
    title: post.title,
    tags: post.tags,
    authorName: post.authorName,
    authorId: post.authorId,
    authorAvatarUrl: post.authorAvatarUrl ?? null,
    sourceMessageId: post.messageId,
    sourceChannelId: post.channelId,
    sourceCreatedAt: post.createdAt,
    sourceUpdatedAt: post.updatedAt,
    status: options.statusOverride ?? post.status,
    hasUnpublishedChanges: options.hasUnpublishedChanges ?? post.hasUnpublishedChanges,
    draftUpdatedAt: post.updatedAt,
    publishedAt: options.publishedAtOverride ?? post.publishedAt,
    attachments: attachments.map((attachment) => attachment.publicUrl)
  });

  return `${frontmatter}${post.body.trim()}${renderAttachmentMarkdown(attachments)}`;
}

export function gitSummaryLines(result: GitAutomationResult): string[] {
  switch (result.status) {
    case 'disabled':
      return [];
    case 'no_changes':
      return ['git: 差分がなかったため追加コミットはありません。'];
    case 'committed':
      return [`git: commit 済み${result.commitSha ? ` (${result.commitSha.slice(0, 7)})` : ''}。push は未実施です。`];
    case 'pushed':
      return [`git: push 済み${result.commitSha ? ` (${result.commitSha.slice(0, 7)})` : ''}。`];
    case 'failed':
      return [
        `git: ${result.errorCode ?? 'unknown'} で失敗しました。${result.commitSha ? ` commit=${result.commitSha.slice(0, 7)}` : ''}`,
        ...(result.errorMessage ? [`git-detail: ${result.errorMessage}`] : [])
      ];
    case 'skipped':
      return ['git: 今回は自動化をスキップしました。'];
    default:
      return [];
  }
}

export function deploymentLabel(status: DeploymentStatus): string {
  switch (status.state) {
    case 'not_applicable':
      return 'deploy: 対象外';
    case 'not_configured':
      return 'deploy: 追跡未設定';
    case 'queued':
      return 'deploy: 待機中';
    case 'in_progress':
      return 'deploy: 反映中';
    case 'success':
      return 'deploy: 公開済み';
    case 'failed':
      return 'deploy: 失敗';
    default:
      return 'deploy: 不明';
  }
}

export function deploymentSummaryLines(status: DeploymentStatus | null): string[] {
  if (!status) {
    return [];
  }

  const lines = [deploymentLabel(status)];

  if (status.workflowRunUrl) {
    lines.push(`deploy-run: ${status.workflowRunUrl}`);
  }

  if (status.detail) {
    lines.push(`deploy-detail: ${status.detail}`);
  }

  return lines;
}

export function summarizeBody(body: string): string {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, PREVIEW_LINE_LIMIT);

  if (lines.length === 0) {
    return '本文なし';
  }

  return lines.join('\n');
}

export function attachmentAltFromName(fileName: string): string {
  return fileName.replace(path.extname(fileName), '') || fileName;
}
