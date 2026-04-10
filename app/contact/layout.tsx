import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us — LOUISLUSO",
  description: "Get in touch with LOUISLUSO. Q-Vision Optics, Arlington Heights, IL.",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{children}</>;
}
