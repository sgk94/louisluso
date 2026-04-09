import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const user = await currentUser();

  if (!user) {
    redirect('/sign-in');
  }

  const role = (user.publicMetadata as { role?: string })?.role;
  if (role !== 'partner') {
    redirect('/');
  }

  return <div>{children}</div>;
}
