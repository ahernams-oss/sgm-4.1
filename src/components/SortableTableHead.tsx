import { ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableHead } from "@/components/ui/table";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeadProps {
  id: string;
  className?: string;
  children: ReactNode;
}

export function SortableTableHead({ id, className, children }: SortableHeadProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const justify = className?.includes("text-center")
    ? "justify-center"
    : className?.includes("text-right")
      ? "justify-end"
      : "justify-start";
  return (
    <TableHead ref={setNodeRef} style={style} className={cn("group select-none", className)}>
      <span className={cn("flex items-center gap-1.5", justify)}>
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
          title="Arraste para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        {children}
      </span>
    </TableHead>
  );
}

interface SortableTableProps {
  order: string[];
  onReorder: (newOrder: string[]) => void;
  children: ReactNode;
}

/** Wraps the whole <Table> inside a DndContext + SortableContext. */
export function SortableTableWrapper({ order, onReorder, children }: SortableTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(order, oldIndex, newIndex));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// Backwards-compat alias (kept for existing imports)
export const SortableHeaderRow = SortableTableWrapper;
