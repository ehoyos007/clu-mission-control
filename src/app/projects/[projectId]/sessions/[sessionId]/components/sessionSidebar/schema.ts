import { z } from "zod";

export const tabSchema = z.enum([
  "sessions",
  "activity",
  "mcp",
  "scheduler",
  "tasks",
  "kanban",
  "settings",
  "system-info",
]);

export type Tab = z.infer<typeof tabSchema>;
