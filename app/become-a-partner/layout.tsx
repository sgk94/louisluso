import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a Partner — LOUISLUSO",
  description: "Apply to become a LOUISLUSO wholesale partner. Competitive pricing for optical stores.",
};

export default function BecomeAPartnerLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
