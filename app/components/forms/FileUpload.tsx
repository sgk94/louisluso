"use client";

import React, { useRef, useState } from "react";

interface FileUploadProps {
  label: string;
  name: string;
  accept?: string;
  maxSizeMB?: number;
  required?: boolean;
  onFileSelect: (file: File | null) => void;
  error?: string;
}

export function FileUpload({ label, name, accept = ".pdf", maxSizeMB = 20, required = false, onFileSelect, error }: FileUploadProps): React.ReactElement {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null): void {
    if (!file) { setFileName(null); onFileSelect(null); return; }
    if (file.size > maxSizeMB * 1024 * 1024) { setFileName(null); onFileSelect(null); return; }
    setFileName(file.name);
    onFileSelect(file);
  }

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-[1px] text-gray-500">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0] ?? null); }}
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-8 transition-colors ${
          dragOver ? "border-bronze bg-warm-bg" : error ? "border-red-400" : "border-gray-200 hover:border-gray-400"
        }`}
      >
        {fileName ? (
          <p className="text-sm text-gray-700">{fileName}</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-gray-400">PDF only, max {maxSizeMB}MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
