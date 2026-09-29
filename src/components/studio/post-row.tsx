import { Link } from "@tanstack/react-router";
import { PLATFORM_META, STATUS_LABEL } from "@/lib/studio/constants";
import { formatNumber, formatWhen } from "@/lib/studio/format";
import { scorePost } from "@/lib/studio/score";
import type { Post } from "@/lib/studio/types";
import { Badge } from "@/components/ui/badge";
import { PlatformMark } from "./platform-chip";

export function PostRow({ post }: { post: Post }) {
  const scored = scorePost(post);
  return (
    <Link
      to="/create"
      search={{ id: post.id }}
      className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-raised"
    >
      <PlatformMark platform={post.platform} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm text-fg">{post.title}</p>
          <Badge tone={post.status}>{STATUS_LABEL[post.status]}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          {PLATFORM_META[post.platform].label}
          {" · "}
          {post.status === "published"
            ? formatWhen(post.publishedAt)
            : post.status === "scheduled"
              ? formatWhen(post.scheduledAt)
              : `Desk score ${scored.score}`}
        </p>
      </div>
      {post.metrics && (
        <p className="hidden shrink-0 text-xs tabular text-muted sm:block">
          {formatNumber(post.metrics.engagement)} eng
        </p>
      )}
    </Link>
  );
}
