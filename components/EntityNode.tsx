import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Database, Box, Table2, Link2 } from "lucide-react";

const EntityNode = ({ data, selected }: NodeProps) => {
  const { table, model, onEdit } = data;
  const isPivot = table?.isPivot;

  return (
    <div
      onClick={() => onEdit(data)}
      className={`
        group transition-all duration-200 cursor-pointer
        w-[260px] rounded-xl border bg-white dark:bg-slate-950 shadow-sm
        ${
          selected
            ? "ring-2 ring-indigo-500 border-transparent shadow-md"
            : "border-slate-200 dark:border-slate-800"
        }
        hover:border-indigo-400 dark:hover:border-indigo-500
      `}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />

      {/* Header */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
        <div className="flex items-center gap-2 overflow-hidden">
          {model ? (
            <Box size={16} className="text-indigo-500 shrink-0" />
          ) : (
            <Table2 size={16} className="text-slate-400 shrink-0" />
          )}
          <span className="text-sm font-semibold truncate dark:text-slate-200">
            {model?.class || table?.name}
          </span>
        </div>
        {isPivot && (
          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-medium">
            PIVOT
          </span>
        )}
      </div>

      {/* Columns List */}
      <div className="py-2">
        {table?.columns.slice(0, 8).map((col: any, i: number) => (
          <div
            key={`${col.name}-${i}`}
            className="px-3 py-1 flex items-center justify-between text-[11px] hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-1 h-1 rounded-full ${
                  col.isPk
                    ? "bg-yellow-500"
                    : col.isFk
                    ? "bg-indigo-500"
                    : "bg-slate-300 dark:bg-slate-700"
                }`}
              />
              <span
                className={`truncate max-w-[120px] ${
                  col.isPk ? "font-bold" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {col.name}
              </span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono uppercase italic">
              {col.type}
            </span>
          </div>
        ))}
        {table?.columns.length > 8 && (
          <div className="px-3 pt-1 text-[10px] text-slate-400 text-center italic">
            + {table.columns.length - 8} more columns
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
};

export default memo(EntityNode);
