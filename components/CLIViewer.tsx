import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Terminal, Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CLIViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: any[];
}

export function CLIViewer({ open, onOpenChange, files }: CLIViewerProps) {
  const [copied, setCopied] = useState(false);

  const generateShellScript = () => {
    let script =
      "#!/bin/bash\n\n# Laravel Flow Setup Script\n# Run this in your Laravel project root\n\n";

    files.forEach((file) => {
      // Escape single quotes for heredoc
      const content = file.content.replace(/'/g, "'\\''");
      // Remove leading slash from path
      const path = file.path.startsWith("/") ? file.path.slice(1) : file.path;

      script += `echo "Creating ${path}..."\n`;
      script += `mkdir -p "$(dirname "${path}")"\n`;
      script += `cat <<'EOF' > "${path}"\n${file.content}\nEOF\n\n`;
    });

    script += `echo "Done! Don't forget to run 'php artisan migrate'"`;

    return script;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateShellScript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[800px] sm:w-[900px] sm:max-w-[90vw] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" /> CLI Integration
          </SheetTitle>
          <SheetDescription>
            Copy this shell script to instantly create all migration and model
            files in your Laravel project.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex-1 min-h-0 border rounded-md relative group">
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 z-10 h-8"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="mr-2 h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-3 w-3" /> Copy Script
              </>
            )}
          </Button>
          <ScrollArea className="h-[600px] w-full rounded-md bg-muted border border-border">
            <SyntaxHighlighter
              language="bash"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: "1.5rem",
                fontSize: "12px",
                background: "transparent",
              }}
              wrapLongLines={true}
            >
              {generateShellScript()}
            </SyntaxHighlighter>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
