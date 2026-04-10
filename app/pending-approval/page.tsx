import Link from "next/link";

export const metadata = {
  title: "Account Pending | LOUISLUSO",
};

export default function PendingPage(): React.ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-3xl text-white">Account Pending</h1>
        <p className="mt-4 text-sm text-gray-400">
          Your partner application is being reviewed. We&apos;ll be in touch soon.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Questions? Contact{" "}
          <a href="mailto:cs@louisluso.com" className="text-bronze hover:underline">
            cs@louisluso.com
          </a>
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-bronze px-6 py-2.5 text-xs font-medium uppercase tracking-[2px] text-bronze transition-colors hover:bg-bronze hover:text-white"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
