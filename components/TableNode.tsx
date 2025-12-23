import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, Box } from "lucide-react";

const TableNode = ({ data }: NodeProps) => {
  const { table, model } = data;

  return (
    <Card
      className={`w-[280px] shadow-lg border-2 ${
        model ? "border-slate-200" : "border-orange-200"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-500"
      />

      <CardHeader className="p-3 bg-slate-50 border-b">
        <CardTitle className="text-sm font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>{table.name}</span>
          </div>
          {model ? (
            <Badge
              variant="outline"
              className="text-[10px] bg-green-50 text-green-700 border-green-200"
            >
              <Box className="w-3 h-3 mr-1" /> {model.name}
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">
              No Model
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex flex-col max-h-[200px] overflow-y-auto text-xs">
          {table.columns.map((col: any) => (
            <div
              key={col.name}
              className="flex justify-between items-center p-2 border-b last:border-0 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                {col.isPk && (
                  <span
                    className="text-yellow-500 font-bold"
                    title="Primary Key"
                  >
                    PK
                  </span>
                )}
                {col.isFk && (
                  <span className="text-blue-500 font-bold" title="Foreign Key">
                    FK
                  </span>
                )}
                <span className={col.isPk ? "font-semibold" : ""}>
                  {col.name}
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[10px]">
                {col.type}
              </span>
            </div>
          ))}
        </div>
      </CardContent>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-500"
      />
    </Card>
  );
};

export default memo(TableNode);
