import { Column, Table, Model } from "@/types";

export interface AISchemaTable {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable?: boolean;
    isPk?: boolean;
  }[];
}

export interface AISchemaRelation {
  fromModel: string;
  type: string; // hasMany, belongsTo, etc.
  toModel: string;
  methodName: string;
}

export interface AISchema {
  tables: AISchemaTable[];
  relations: AISchemaRelation[];
}

export const generateLaravelMigration = (
  table: AISchemaTable,
  timestamp: string
): string => {
  const className = `Create${toPascalCase(table.name)}Table`;
  
  const columnsCode = table.columns
    .map((col) => {
        if (col.type === 'id' || (col.name === 'id' && col.type === 'bigIncrements')) {
            return `            $table->id();`;
        }
        
        // Handle foreignId
        if (col.type === 'foreignId') {
             let line = `            $table->foreignId('${col.name}')`;
             if (col.nullable) line += "->nullable()";
             line += "->constrained()->cascadeOnDelete();";
             return line;
        }

        let line = `            $table->${col.type}('${col.name}')`;
        if (col.nullable) line += "->nullable()";
        line += ";";
        return line;
    })
    .join("\n");

  return `<?php

import Illuminate\\Database\\Migrations\\Migration;
import Illuminate\\Database\\Schema\\Blueprint;
import Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${table.name}', function (Blueprint $table) {
${columnsCode}
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${table.name}');
    }
};
`;
};

export const generateLaravelModel = (
  modelName: string,
  tableName: string,
  relations: AISchemaRelation[]
): string => {
  const relationMethods = relations
    .map((rel) => {
      return `    public function ${rel.methodName}()
    {
        return $this->${rel.type}(${rel.toModel}::class);
    }`;
    })
    .join("\n\n");

  return `<?php

namespace App\\Models;

import Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
import Illuminate\\Database\\Eloquent\\Model;

class ${modelName} extends Model
{
    use HasFactory;

    protected $table = '${tableName}';

${relationMethods}
}
`;
};

// Helper
const toPascalCase = (str: string) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      word.toUpperCase()
    )
    .replace(/\s+/g, "")
    .replace(/_/g, "");
};
