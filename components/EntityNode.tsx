import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Box, Table2, Hash, Key } from "lucide-react";
import { cn } from "@/lib/utils";

const EntityNode = ({ data, selected }: NodeProps) => {
  const { table, model, onEdit } = data;

  return (
    <div
      onClick={() => onEdit(data)}
      className={cn(
        "group min-w-[240px] rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200",
        selected
          ? "ring-2 ring-primary border-transparent"
          : "hover:border-primary/50"
      )}
    >
      {/* Header */}
      <div className="relative flex items-center gap-3 p-3 border-b border-border bg-muted/30">
        <Handle
          type="target"
          position={Position.Left}
          className="w-2 h-2 !bg-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity"
        />
        <div className="p-1.5 bg-background rounded-md border border-border">
          {model ? (
            <Box size={14} className="text-primary" />
          ) : (
            <Table2 size={14} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-xs font-bold leading-none truncate">
            {model?.class || table?.name}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono mt-1">
            {table?.name || "no table"}
          </span>
        </div>
        <Handle
          type="source"
          position={Position.Right}
          className="w-2 h-2 !bg-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Columns */}
      <div className="p-1">
        {table?.columns.map((col: any, i: number) => (
          <div
            key={`${col.name}-${i}`}
            className="relative flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted group/row"
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`target-${col.name}`}
              className="w-2 h-2 !bg-muted-foreground/30 opacity-0 group-hover/row:opacity-100 transition-opacity"
            />
            <div className="flex items-center gap-2">
              {col.isPk ? (
                <Key size={10} className="text-yellow-500 fill-yellow-500/20" />
              ) : (
                <Hash
                  size={10}
                  className={cn(
                    "text-muted-foreground",
                    col.isFk && "text-primary"
                  )}
                />
              )}
              <span
                className={cn(
                  "text-[11px] font-medium",
                  col.isPk ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {col.name}
              </span>
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/60 uppercase group-hover/row:text-muted-foreground">
              {col.type}
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id={`source-${col.name}`}
              className="w-2 h-2 !bg-muted-foreground/30 opacity-0 group-hover/row:opacity-100 transition-opacity"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(EntityNode);
