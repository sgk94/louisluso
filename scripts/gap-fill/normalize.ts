export function normEmail(s: string | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

export function normCompany(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export function normPhone(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function buildMatchKey(email: string | undefined, company: string | undefined): string {
  const e = normEmail(email);
  if (e) return `email:${e}`;
  const c = normCompany(company);
  if (c) return `company:${c}`;
  return "";
}
