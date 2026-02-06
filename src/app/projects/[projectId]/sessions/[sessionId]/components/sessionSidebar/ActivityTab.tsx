import { formatDistanceToNow } from "date-fns";
import {
  ActivityIcon,
  BotIcon,
  CheckCircle2,
  GitPullRequestIcon,
  Loader2,
  PlayIcon,
  PlusCircleIcon,
  XCircleIcon,
} from "lucide-react";
import type { FC } from "react";
import { useActivities } from "@/hooks/useActivities";
import type { Activity } from "@/lib/supabase";

const getActivityIcon = (type: string) => {
  switch (type) {
    case "session_marked_clu":
    case "task_assigned_clu":
      return <BotIcon className="w-4 h-4 text-primary" />;
    case "session_unmarked_clu":
    case "task_unassigned_clu":
      return <XCircleIcon className="w-4 h-4 text-muted-foreground" />;
    case "session_started":
      return <PlayIcon className="w-4 h-4 text-green-500" />;
    case "session_completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "task_created":
      return <PlusCircleIcon className="w-4 h-4 text-blue-500" />;
    case "task_completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "pr_opened":
    case "pr_merged":
    case "pr_closed":
      return <GitPullRequestIcon className="w-4 h-4 text-purple-500" />;
    default:
      return <ActivityIcon className="w-4 h-4 text-muted-foreground" />;
  }
};

const ActivityItem: FC<{ activity: Activity }> = ({ activity }) => {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
    addSuffix: true,
  });

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-sidebar-border/40 bg-sidebar/30 hover:bg-sidebar/50 transition-colors">
      <div className="mt-0.5 shrink-0">{getActivityIcon(activity.type)}</div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium leading-tight line-clamp-2">
          {activity.title}
        </p>
        {activity.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {activity.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70">{timeAgo}</p>
      </div>
    </div>
  );
};

const EmptyState: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-sidebar-accent/50 flex items-center justify-center mb-4">
        <ActivityIcon className="w-6 h-6 text-sidebar-foreground/40" />
      </div>
      <p className="text-sm font-medium text-sidebar-foreground/70">
        No activity yet
      </p>
      <p className="text-xs text-sidebar-foreground/50 mt-1">
        Activity will appear here as Clu works
      </p>
    </div>
  );
};

const LoadingState: FC = () => {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex items-center gap-2 text-sidebar-foreground/60">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading activity...</span>
      </div>
    </div>
  );
};

const NotConfiguredState: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
        <ActivityIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="text-sm font-medium text-sidebar-foreground/70">
        Supabase not configured
      </p>
      <p className="text-xs text-sidebar-foreground/50 mt-1">
        Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable activity
        tracking
      </p>
    </div>
  );
};

export const ActivityTab: FC = () => {
  const { activities, loading, isConfigured } = useActivities(30);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <BotIcon className="w-5 h-5 text-primary" />
            Clu Activity
          </h2>
        </div>
        <p className="text-xs text-sidebar-foreground/70">
          {activities.length} recent events
        </p>
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {!isConfigured && <NotConfiguredState />}
        {isConfigured && loading && <LoadingState />}
        {isConfigured && !loading && activities.length === 0 && <EmptyState />}
        {isConfigured &&
          !loading &&
          activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
      </div>
    </div>
  );
};
