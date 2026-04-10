"use client";

import React from "react";

interface SelectProps {
  label: string;
  name: string;
  required?: boolean;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function Select({ label, name, required = false, options, value, onChange, error }: SelectProps): React.ReactElement {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium uppercase tracking-[1px] text-gray-500">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-bronze ${error ? "border-red-400" : "border-gray-200"}`}
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
