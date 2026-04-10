"use client";

import React from "react";

interface TextInputProps {
  label: string;
  name: string;
  type?: "text" | "email" | "tel";
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TextInput({ label, name, type = "text", required = false, placeholder, value, onChange, error }: TextInputProps): React.ReactElement {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium uppercase tracking-[1px] text-gray-500">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-bronze ${error ? "border-red-400" : "border-gray-200"}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
