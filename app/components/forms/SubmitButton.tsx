"use client";

import React from "react";

interface SubmitButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SubmitButton({ label, loading = false, disabled = false }: SubmitButtonProps): React.ReactElement {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full border border-bronze bg-bronze px-8 py-3 text-[13px] font-medium uppercase tracking-[2px] text-white transition-colors hover:bg-bronze-light disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? "Submitting..." : label}
    </button>
  );
}
