import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface FileEntry {
  path: string;
  name: string;
  content: string;
  type: "migration" | "model";
}

// Optimized loader: filters PATHS before reading CONTENTS
export const processDirectoryUpload = async (
  files: FileList,
  onProgress?: (msg: string) => void
): Promise<FileEntry[]> => {
  const entries: FileEntry[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const path = file.webkitRelativePath || file.name;

    // Skip heavy folders immediately
    if (
      path.includes("/node_modules/") ||
      path.includes("/vendor/") ||
      path.includes("/storage/") ||
      path.includes("/public/")
    ) {
      continue;
    }

    let type: "migration" | "model" | null = null;

    // Strict detection logic
    if (path.includes("database/migrations") && path.endsWith(".php")) {
      type = "migration";
    } else if (path.includes("app/Models") && path.endsWith(".php")) {
      type = "model";
    } else if (
      path.includes("app/") &&
      path.endsWith(".php") &&
      !path.includes("Http") &&
      !path.includes("Providers")
    ) {
      // Fallback for older Laravel structures, strictly avoiding controllers
      type = "model";
    }

    if (type) {
      if (onProgress && i % 50 === 0) onProgress(`Scanning: ${file.name}`);
      const content = await file.text();
      entries.push({ path, name: file.name, content, type });
    }
  }

  return entries;
};

export const exportProjectToZip = async (files: FileEntry[]) => {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "laravel-architecture-export.zip");
};
