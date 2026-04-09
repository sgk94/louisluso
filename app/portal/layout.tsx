import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Authentication is handled by Clerk middleware in proxy.ts.
// This layout only checks authorization (partner role).
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await currentUser();

  const role = (user?.publicMetadata as { role?: string } | undefined)?.role;
  if (role !== 'partner') {
    redirect('/');
  }

  return <div>{children}</div>;
}
