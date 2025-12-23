import React from "react";
import { SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Plus, Trash2, Database, Key, Link } from "lucide-react";
import { Column } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LARAVEL_COLUMN_TYPES = [
  "id",
  "string",
  "integer",
  "bigInteger",
  "text",
  "boolean",
  "date",
  "dateTime",
  "timestamp",
  "decimal",
  "float",
  "json",
  "uuid",
  "binary",
  "char",
  "double",
  "enum",
  "ipAddress",
  "macAddress",
  "geometry",
  "point",
  "foreignId",
];

interface SupabaseEditorProps {
  data: {
    table: {
      name: string;
      columns: Column[];
    };
  };
  onSave: (columns: Column[]) => void;
}

export const SupabaseEditor = ({ data, onSave }: SupabaseEditorProps) => {
  const [columns, setColumns] = React.useState<Column[]>(
    data.table?.columns || []
  );

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      {
        name: "new_column",
        type: "string",
        isPk: false,
        isFk: false,
        nullable: true,
      },
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    const newCols = [...columns];
    newCols.splice(index, 1);
    setColumns(newCols);
  };

  const handleUpdateColumn = (
    index: number,
    field: keyof Column,
    value: any
  ) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [field]: value };
    setColumns(newCols);
  };

  return (
    <SheetContent
      side="right"
      className="min-w-[35vw] sm:max-w-[80vw] flex flex-col p-0 bg-background border-l border-border"
    >
      <div className="p-6 border-b flex items-center justify-between bg-muted/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-primary" />
            <SheetTitle className="text-sm font-bold uppercase tracking-tight">
              Table Editor
            </SheetTitle>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {data.table?.name}
          </p>
        </div>
        <Button
          onClick={() => onSave(columns)}
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Save size={16} /> Save Changes
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Columns ({columns.length})
          </h3>
          <Button
            onClick={handleAddColumn}
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
          >
            <Plus size={14} /> Add Column
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead className="w-[150px]">Type</TableHead>
                <TableHead className="w-[100px] text-center">
                  Attributes
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col, i) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        value={col.name}
                        onChange={(e) =>
                          handleUpdateColumn(i, "name", e.target.value)
                        }
                        className="h-8 text-xs font-mono"
                        placeholder="column_name"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={col.type}
                      onValueChange={(value) =>
                        handleUpdateColumn(i, "type", value)
                      }
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {LARAVEL_COLUMN_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        title="Primary Key"
                        onClick={() => handleUpdateColumn(i, "isPk", !col.isPk)}
                        className={`p-1.5 rounded-md transition-colors ${
                          col.isPk
                            ? "bg-amber-500/10 text-amber-600 ring-1 ring-amber-200"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Key size={14} />
                      </button>

                      <button
                        title="Foreign Key"
                        onClick={() => handleUpdateColumn(i, "isFk", !col.isFk)}
                        className={`p-1.5 rounded-md transition-colors ${
                          col.isFk
                            ? "bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-200"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Link size={14} />
                      </button>

                      <button
                        title="Nullable"
                        onClick={() =>
                          handleUpdateColumn(i, "nullable", !col.nullable)
                        }
                        className={`p-1.5 rounded-md transition-colors ${
                          col.nullable
                            ? "bg-blue-500/10 text-blue-600 ring-1 ring-blue-200"
                            : "text-muted-foreground hover:bg-muted opacity-50"
                        }`}
                      >
                        <span className="text-[10px] font-bold px-0.5">N</span>
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => handleRemoveColumn(i)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </SheetContent>
  );
};
