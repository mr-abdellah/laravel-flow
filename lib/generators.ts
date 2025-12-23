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

// --- Helpers ---

const toPascalCase = (str: string) =>
  str.replace(/(^\w|_\w)/g, (m) => m.replace("_", "").toUpperCase());

const mapToSqlType = (laravelType: string): string => {
  const map: Record<string, string> = {
    string: "VARCHAR(255)",
    integer: "INT",
    bigInteger: "BIGINT",
    bigIncrements: "BIGINT AUTO_INCREMENT",
    text: "TEXT",
    boolean: "BOOLEAN",
    timestamp: "TIMESTAMP",
    datetime: "DATETIME",
    date: "DATE",
    json: "JSON",
    decimal: "DECIMAL(8, 2)",
    float: "FLOAT",
    uuid: "CHAR(36)",
    foreignId: "BIGINT", // Assumption
    id: "BIGINT AUTO_INCREMENT",
  };
  return map[laravelType] || "VARCHAR(255)";
};

const mapToPrismaType = (laravelType: string): string => {
  const map: Record<string, string> = {
    string: "String",
    integer: "Int",
    bigInteger: "BigInt",
    bigIncrements: "BigInt",
    text: "String",
    boolean: "Boolean",
    timestamp: "DateTime",
    datetime: "DateTime",
    date: "DateTime",
    json: "Json",
    decimal: "Decimal",
    float: "Float",
    uuid: "String",
    foreignId: "BigInt",
    id: "BigInt",
  };
  return map[laravelType] || "String";
};

const mapToDjangoField = (laravelType: string): string => {
  const map: Record<string, string> = {
    string: "models.CharField(max_length=255)",
    integer: "models.IntegerField()",
    bigInteger: "models.BigIntegerField()",
    bigIncrements: "models.BigAutoField(primary_key=True)",
    text: "models.TextField()",
    boolean: "models.BooleanField()",
    timestamp: "models.DateTimeField()",
    datetime: "models.DateTimeField()",
    date: "models.DateField()",
    json: "models.JSONField()",
    decimal: "models.DecimalField(max_digits=8, decimal_places=2)",
    float: "models.FloatField()",
    uuid: "models.UUIDField()",
    foreignId: "models.ForeignKey", // Special handling needed
    id: "models.BigAutoField(primary_key=True)",
  };
  return map[laravelType] || "models.CharField(max_length=255)";
};

// --- Generators ---

export const generateLaravelMigration = (
  table: AISchemaTable,
  timestamp: string
): string => {
  const className = `Create${toPascalCase(table.name)}Table`;

  const columnsCode = table.columns
    .map((col) => {
      if (
        col.type === "id" ||
        (col.name === "id" && col.type === "bigIncrements")
      ) {
        return `            $table->id();`;
      }

      // Handle foreignId
      if (col.type === "foreignId") {
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
    
    protected $guarded = [];

${relationMethods}
}
`;
};

// --- New Generators ---

export const generateSQL = (table: Table): string => {
  const columns = table.columns.map((col) => {
    let line = `  \`${col.name}\` ${mapToSqlType(col.type)}`;
    if (!col.nullable) line += " NOT NULL";
    if (col.isPk && col.type !== "bigIncrements" && col.type !== "id") {
      // If it's not auto-increment but is PK
      line += " PRIMARY KEY";
    }
    return line;
  });

  // Add timestamps
  columns.push("  `created_at` TIMESTAMP NULL DEFAULT NULL");
  columns.push("  `updated_at` TIMESTAMP NULL DEFAULT NULL");

  // Primary Keys (if not inline)
  const pkCol = table.columns.find((c) => c.isPk);
  if (pkCol && (pkCol.type === "bigIncrements" || pkCol.type === "id")) {
    // Already handled by AUTO_INCREMENT usually implies PK in MySQL, but good to be explicit
    columns.push(`  PRIMARY KEY (\`${pkCol.name}\`)`);
  }

  // Foreign Keys
  table.foreignKeys.forEach((fk) => {
    columns.push(
      `  CONSTRAINT \`fk_${table.name}_${fk.col}\` FOREIGN KEY (\`${fk.col}\`) REFERENCES \`${fk.refTable}\` (\`id\`) ON DELETE CASCADE`
    );
  });

  return `CREATE TABLE \`${table.name}\` (
${columns.join(",\n")}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
};

export const generatePrismaSchema = (tables: Table[]): string => {
  let schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
`;

  tables.forEach((table) => {
    const modelName = toPascalCase(table.name); // simplistic singularization/capitalization

    const fields = table.columns.map((col) => {
      let type = mapToPrismaType(col.type);
      let modifiers = "";

      if (col.isPk) {
        modifiers += " @id @default(autoincrement())";
      }

      if (col.nullable) {
        type += "?";
      }

      // Foreign Keys - simplified
      // In Prisma, we usually need the relation field AND the scalar field.
      // This generator is a "best effort" starting point.

      return `  ${col.name} ${type}${modifiers}`;
    });

    // Timestamps
    fields.push("  createdAt DateTime @default(now())");
    fields.push("  updatedAt DateTime @updatedAt");

    schema += `
model ${modelName} {
${fields.join("\n")}
}
`;
  });

  return schema;
};

export const generateDjangoModels = (tables: Table[]): string => {
  let output = `from django.db import models\n\n`;

  tables.forEach((table) => {
    const modelName = toPascalCase(table.name); // e.g. users -> Users (Django usually prefers singular, but we'll stick to this for now)

    output += `class ${modelName}(models.Model):\n`;

    const fields = table.columns
      .map((col) => {
        if (col.name === "id") return null; // Django adds AutoField id by default

        let fieldDef = mapToDjangoField(col.type);

        // Handle FK
        if (col.isFk) {
          // Try to find the target table
          // This is a bit weak without full graph context passed in, but we can guess
          const target = col.name.replace("_id", "");
          // We'd ideally need the proper class name of the target.
          // Let's assume PascalCase of the base name.
          const targetClass = toPascalCase(target + "s"); // naive plural check
          fieldDef = `models.ForeignKey('${targetClass}', on_delete=models.CASCADE)`;
        }

        let options: string[] = [];
        if (col.nullable) options.push("null=True", "blank=True");

        // Inject options into the field definition
        if (options.length > 0) {
          if (fieldDef.includes(")")) {
            fieldDef = fieldDef.slice(0, -1) + ", " + options.join(", ") + ")";
          }
        }

        return `    ${col.name} = ${fieldDef}`;
      })
      .filter(Boolean);

    if (fields.length === 0) {
      output += `    pass\n`;
    } else {
      output += fields.join("\n") + "\n";
    }

    output += `
    class Meta:
        db_table = '${table.name}'
\n`;
  });

  return output;
};
