import { redirect } from "next/navigation";

export const metadata = {
  title: "Quote Submitted | LOUISLUSO",
};

export default async function QuoteSuccessPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}): Promise<never> {
  const { estimateNumber } = await params;
  redirect(`/portal/quotes/${encodeURIComponent(estimateNumber)}`);
}
