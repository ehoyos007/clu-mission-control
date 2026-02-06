import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  BotIcon,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  PlusIcon,
  XCircle,
} from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { toast } from "sonner";
import { CluBadge } from "@/components/CluBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActivities } from "@/hooks/useActivities";
import { createTask, listTasks, updateTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskUpdate } from "@/server/core/tasks/schema";

interface KanbanBoardProps {
  projectId: string;
  sessionId?: string;
}

// Column configuration
const COLUMNS: {
  id: TaskStatus;
  label: string;
  icon: FC<{ className?: string }>;
  color: string;
}[] = [
  { id: "pending", label: "To Do", icon: Circle, color: "text-gray-500" },
  {
    id: "in_progress",
    label: "In Progress",
    icon: Clock,
    color: "text-blue-500",
  },
  {
    id: "completed",
    label: "Done",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  { id: "failed", label: "Failed", icon: XCircle, color: "text-red-500" },
];

// Get next status in cycle
const getNextStatus = (current: TaskStatus): TaskStatus => {
  const cycle: TaskStatus[] = ["pending", "in_progress", "completed"];
  const idx = cycle.indexOf(current);
  if (idx === -1) return "pending"; // failed -> pending
  return cycle[(idx + 1) % cycle.length];
};

// Status icon component
const StatusIcon: FC<{ status: TaskStatus; className?: string }> = ({
  status,
  className,
}) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className={cn("text-green-500", className)} />;
    case "in_progress":
      return <Clock className={cn("text-blue-500", className)} />;
    case "failed":
      return <XCircle className={cn("text-red-500", className)} />;
    default:
      return <Circle className={cn("text-gray-400", className)} />;
  }
};

// Sortable task card
const SortableTaskCard: FC<{
  task: Task;
  onToggleOwner: (task: Task) => void;
  onChangeStatus?: (task: Task, newStatus: TaskStatus) => void;
  isDragging?: boolean;
}> = ({ task, onToggleOwner, onChangeStatus, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCluOwned = task.owner === "clu";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl p-3 transition-all duration-200",
        "bg-white dark:bg-gray-800/90",
        "border border-gray-200 dark:border-gray-700",
        "shadow-sm hover:shadow-md",
        "touch-manipulation select-none",
        isSortableDragging && "opacity-50 scale-[1.02] shadow-lg z-50",
        isDragging && "ring-2 ring-primary shadow-xl scale-105",
        isCluOwned && "border-primary/40 bg-primary/5 dark:bg-primary/10",
      )}
    >
      {/* Drag handle - larger touch target for mobile */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center",
          "cursor-grab active:cursor-grabbing",
          "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
          "touch-manipulation",
          "rounded-l-xl",
          "hover:bg-gray-100 dark:hover:bg-gray-700/50",
          "transition-colors",
        )}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Card content - offset for drag handle */}
      <div className="pl-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium line-clamp-2 leading-tight">
                {task.subject}
              </span>
              {isCluOwned && <CluBadge size="sm" />}
            </div>
            <span className="text-[10px] font-mono text-gray-400 mt-0.5 block">
              #{task.id}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0 -mr-1 -mt-1">
            {/* Quick status change button */}
            {onChangeStatus && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChangeStatus(task, getNextStatus(task.status));
                }}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  "min-w-[40px] min-h-[40px] flex items-center justify-center",
                  "hover:bg-gray-100 dark:hover:bg-gray-700",
                  "active:scale-95",
                )}
                title={`Move to ${getNextStatus(task.status)}`}
              >
                <StatusIcon status={task.status} className="w-4 h-4" />
                <ChevronRight className="w-3 h-3 text-gray-400" />
              </button>
            )}

            {/* Assign to Clu button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleOwner(task);
              }}
              className={cn(
                "p-2 rounded-lg transition-all",
                "min-w-[40px] min-h-[40px] flex items-center justify-center",
                isCluOwned
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-gray-400 hover:text-primary hover:bg-primary/10",
              )}
              title={isCluOwned ? "Unassign from Clu" : "Assign to Clu"}
            >
              <BotIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Blocked by badges */}
        {task.blockedBy &&
          task.blockedBy.length > 0 &&
          task.status !== "completed" && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.blockedBy.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
                >
                  <AlertTriangle className="w-2.5 h-2.5" />#{id}
                </span>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

// Static card for drag overlay
const TaskCardOverlay: FC<{ task: Task }> = ({ task }) => {
  const isCluOwned = task.owner === "clu";

  return (
    <div
      className={cn(
        "rounded-xl p-3",
        "bg-white dark:bg-gray-800",
        "border-2 border-primary",
        "shadow-2xl",
        "rotate-2 scale-105",
        isCluOwned && "bg-primary/5 dark:bg-primary/10",
      )}
    >
      <div className="pl-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium line-clamp-1">
            {task.subject}
          </span>
          {isCluOwned && <CluBadge size="sm" />}
        </div>
      </div>
    </div>
  );
};

// Kanban column with droppable area
const KanbanColumn: FC<{
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  onToggleOwner: (task: Task) => void;
  onChangeStatus: (task: Task, newStatus: TaskStatus) => void;
  activeId: string | null;
}> = ({ column, tasks, onToggleOwner, onChangeStatus, activeId }) => {
  const Icon = column.icon;
  const isEmpty = tasks.length === 0;

  // Make the column a drop target
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      className={cn(
        "flex flex-col",
        "min-w-[280px] w-[280px] max-w-[320px]",
        "md:min-w-0 md:w-full md:max-w-none md:flex-1",
        "bg-gray-50 dark:bg-gray-900/50",
        "rounded-2xl",
        "border-2 transition-colors duration-200",
        isOver
          ? "border-primary bg-primary/5 dark:bg-primary/10"
          : "border-gray-200 dark:border-gray-700/50",
        "shadow-sm",
        "snap-start md:snap-align-none", // Snap on mobile
        "shrink-0 md:shrink", // Don't shrink on mobile
      )}
    >
      {/* Column header */}
      <div
        className={cn(
          "p-3 border-b transition-colors duration-200",
          isOver
            ? "border-primary/30 bg-primary/5"
            : "border-gray-200 dark:border-gray-700/50",
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", column.color)} />
          <span className="font-medium text-sm">{column.label}</span>
          <span
            className={cn(
              "ml-auto text-xs px-2 py-0.5 rounded-full transition-colors",
              isOver
                ? "bg-primary/20 text-primary"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400",
            )}
          >
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Column content - scrollable and droppable */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 overflow-y-auto overscroll-contain min-h-[200px] max-h-[calc(100vh-280px)]",
          "transition-colors duration-200",
          isOver && isEmpty && "bg-primary/5",
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onToggleOwner={onToggleOwner}
                onChangeStatus={onChangeStatus}
                isDragging={activeId === task.id}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state / drop zone indicator */}
        {isEmpty && (
          <div
            className={cn(
              "flex flex-col items-center justify-center py-8 text-center",
              "border-2 border-dashed rounded-xl transition-colors duration-200",
              isOver
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent",
            )}
          >
            <Icon
              className={cn(
                "w-8 h-8 mb-2",
                isOver ? "opacity-100" : "opacity-30",
                column.color,
              )}
            />
            <p className="text-xs text-gray-400">
              {isOver ? "Drop here" : "No tasks"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Create task dialog
const CreateTaskDialog: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (subject: string, description: string) => void;
  isPending: boolean;
}> = ({ open, onOpenChange, onSubmit, isPending }) => {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onSubmit(subject, description);
    setSubject("");
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task to your board.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="kanban-subject">Title</Label>
            <Input
              id="kanban-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Implement login flow"
              className="text-base" // Prevent iOS zoom
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kanban-description">Description</Label>
            <Textarea
              id="kanban-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              className="text-base min-h-[100px]" // Prevent iOS zoom
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px]" // iOS touch target
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !subject.trim()}
              className="min-h-[44px]" // iOS touch target
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Kanban Board
export const KanbanBoard: FC<KanbanBoardProps> = ({ projectId, sessionId }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showCluOnly, setShowCluOnly] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { logActivity } = useActivities();
  const queryClient = useQueryClient();

  // Sensors for both pointer and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // 150ms hold before drag starts
        tolerance: 8, // 8px movement tolerance during delay
      },
    }),
  );

  // Fetch tasks
  const {
    data: tasks,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", projectId, sessionId],
    queryFn: () => listTasks(projectId, sessionId),
    refetchInterval: 5000,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { subject: string; description?: string }) =>
      createTask(projectId, data, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", projectId, sessionId],
      });
      setIsCreateOpen(false);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: { turnId: string; update: Partial<TaskUpdate> }) =>
      updateTask(projectId, data.turnId, data.update, sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", projectId, sessionId],
      });
    },
    onError: () => toast.error("Failed to update task"),
  });

  // Toggle owner handler
  const handleToggleOwner = (task: Task) => {
    const newOwner = task.owner === "clu" ? undefined : "clu";
    updateMutation.mutate({ turnId: task.id, update: { owner: newOwner } });

    if (newOwner === "clu") {
      toast.success("Assigned to Clu");
      void logActivity(
        "task_assigned_clu",
        `Task assigned to Clu: ${task.subject}`,
        `Task #${task.id} assigned to Clu`,
        { taskId: task.id, subject: task.subject },
      );
    } else {
      toast.success("Unassigned from Clu");
    }
  };

  // Quick status change handler
  const handleChangeStatus = (task: Task, newStatus: TaskStatus) => {
    updateMutation.mutate({ turnId: task.id, update: { status: newStatus } });
    const col = COLUMNS.find((c) => c.id === newStatus);
    toast.success(`Moved to ${col?.label ?? newStatus}`);
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      const task = tasks?.find((t) => t.id === taskId);
      if (task && task.status !== targetColumn.id) {
        updateMutation.mutate({
          turnId: taskId,
          update: { status: targetColumn.id },
        });
        toast.success(`Moved to ${targetColumn.label}`);
      }
      return;
    }

    // Check if dropped on another task - find that task's column
    const targetTask = tasks?.find((t) => t.id === overId);
    if (targetTask) {
      const task = tasks?.find((t) => t.id === taskId);
      if (task && task.status !== targetTask.status) {
        updateMutation.mutate({
          turnId: taskId,
          update: { status: targetTask.status },
        });
        const col = COLUMNS.find((c) => c.id === targetTask.status);
        toast.success(`Moved to ${col?.label ?? targetTask.status}`);
      }
    }
  };

  // Filter and group tasks by status
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return showCluOnly ? tasks.filter((t) => t.owner === "clu") : tasks;
  }, [tasks, showCluOnly]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      failed: [],
    };
    for (const task of filteredTasks) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [filteredTasks]);

  // Active task for drag overlay
  const activeTask = useMemo(() => {
    if (!activeId || !tasks) return null;
    return tasks.find((t) => t.id === activeId) ?? null;
  }, [activeId, tasks]);

  // Task counts
  const totalCount = tasks?.length ?? 0;
  const cluCount = tasks?.filter((t) => t.owner === "clu").length ?? 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading tasks...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load tasks
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col bg-white dark:bg-gray-900 transition-all duration-300",
        isFullscreen ? "fixed inset-0 z-50" : "h-full",
      )}
    >
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-lg truncate">Kanban Board</h2>
            <p className="text-xs text-gray-500">
              {showCluOnly ? `${filteredTasks.length} Clu / ` : ""}
              {totalCount} tasks
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Clu filter */}
            {cluCount > 0 && (
              <Button
                size="sm"
                variant={showCluOnly ? "default" : "outline"}
                onClick={() => setShowCluOnly(!showCluOnly)}
                className={cn(
                  "gap-1 min-h-[44px] min-w-[44px] px-2.5",
                  showCluOnly && "bg-primary text-primary-foreground",
                )}
              >
                <BotIcon className="w-4 h-4" />
                <span className="text-sm">{cluCount}</span>
              </Button>
            )}

            {/* Fullscreen toggle - mobile only */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="min-h-[44px] min-w-[44px] px-2.5 md:hidden"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>

            {/* Create button */}
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 min-h-[44px] px-3"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban columns - horizontal scroll on mobile */}
      <div className="flex-1 overflow-hidden relative">
        {/* Scroll hint gradient - mobile only */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none z-10 md:hidden" />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              "h-full p-4 pb-6",
              "flex gap-3 md:gap-4",
              "overflow-x-auto overflow-y-hidden",
              "snap-x snap-mandatory md:snap-none",
              "scrollbar-none md:scrollbar-thin md:scrollbar-thumb-gray-300 dark:md:scrollbar-thumb-gray-600",
              "overscroll-x-contain",
            )}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={tasksByStatus[column.id]}
                onToggleOwner={handleToggleOwner}
                onChangeStatus={handleChangeStatus}
                activeId={activeId}
              />
            ))}
            {/* End spacer for mobile scroll */}
            <div className="min-w-4 md:hidden" aria-hidden />
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeTask && <TaskCardOverlay task={activeTask} />}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create task dialog */}
      <CreateTaskDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={(subject, description) =>
          createMutation.mutate({
            subject,
            description: description || undefined,
          })
        }
        isPending={createMutation.isPending}
      />
    </div>
  );
};

export default KanbanBoard;
