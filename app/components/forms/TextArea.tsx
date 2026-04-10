"use client";

import React from "react";

interface TextAreaProps {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TextArea({ label, name, required = false, placeholder, rows = 5, value, onChange, error }: TextAreaProps): React.ReactElement {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium uppercase tracking-[1px] text-gray-500">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <textarea
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-bronze ${error ? "border-red-400" : "border-gray-200"}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
