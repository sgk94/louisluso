import Link from "next/link";

const shopLinks = [
  { label: "Eyeglasses", href: "/eyeglasses" },
  { label: "Sunglasses", href: "/sunglasses" },
  { label: "Accessories", href: "/accessories" },
];

const companyLinks = [
  { label: "Why LOUISLUSO", href: "/why-louisluso" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

const connectLinks = [
  { label: "Find a Dealer", href: "/find-a-dealer" },
  { label: "Become a Partner", href: "/become-a-partner" },
  { label: "Facebook", href: "https://www.facebook.com/louisluso", external: true },
  { label: "Instagram", href: "https://www.instagram.com/louisluso", external: true },
];

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}): React.ReactElement {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-[1.5px] text-gray-400">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="text-sm text-gray-500 transition-colors hover:text-white">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer(): React.ReactElement {
  return (
    <footer className="bg-[#0a0a0a] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12">
          <Link href="/" className="font-heading text-2xl tracking-[4px] text-white">
            LOUISLUSO
          </Link>
          <p className="mt-2 text-xs uppercase tracking-[1.5px] text-bronze">
            The World&apos;s Lightest Frames
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <FooterLinkGroup title="Shop" links={shopLinks} />
          <FooterLinkGroup title="Company" links={companyLinks} />
          <FooterLinkGroup title="Connect" links={connectLinks} />
        </div>
        <div className="mt-12 border-t border-gray-800 pt-8">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} LOUISLUSO. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
