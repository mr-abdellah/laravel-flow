import React from "react";
import { SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, Database } from "lucide-react";

export const SupabaseEditor = ({ data, onSave }: any) => {
  const [columns, setColumns] = React.useState(data.table?.columns || []);

  return (
    <SheetContent
      side="right"
      className="w-[500px] sm:max-w-[40vw] flex flex-col p-0 bg-background border-l border-border"
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
          <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
            <Plus size={14} /> Add Column
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {columns.map((col: any, i: number) => (
                <TableRow key={i} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Input
                        defaultValue={col.name}
                        className="h-8 text-xs font-mono"
                      />
                      <div className="flex gap-1">
                        {col.isPk && (
                          <Badge className="text-[9px] h-4 bg-amber-500/10 text-amber-600 border-amber-200">
                            PK
                          </Badge>
                        )}
                        {col.isFk && (
                          <Badge className="text-[9px] h-4 bg-indigo-500/10 text-indigo-600 border-indigo-200">
                            FK
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select className="bg-transparent text-xs border rounded p-1 w-full dark:border-slate-800">
                      <option>{col.type}</option>
                      <option>uuid</option>
                      <option>string</option>
                      <option>integer</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
