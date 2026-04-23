import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Toaster } from '@/components/ui/sonner';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user as any;

  // Fetch the company's uploaded logo (if any) — lives on Company, not on session.
  const company = user?.companyId
    ? await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { logoUrl: true },
      })
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <Sidebar
        userName={user?.name ?? 'User'}
        userRole={user?.role ?? ''}
        companyName={user?.companyName ?? 'SCM'}
        companyLogoUrl={company?.logoUrl ?? null}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          userName={user?.name ?? 'User'}
          userEmail={user?.email ?? ''}
          userRole={user?.role ?? ''}
        />
        <main className="flex-1 overflow-y-auto bg-app">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
