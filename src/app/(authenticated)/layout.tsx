import { auth } from '@/auth';
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

  return (
    <div className="flex h-screen overflow-hidden bg-app">
      <Sidebar userName={user?.name ?? 'User'} userRole={user?.role ?? ''} />
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
