import { auth, signOut } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">AWG Construction CRM</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/login' });
                }}
              >
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {user.name}! 👋
          </h2>
          <p className="text-gray-600">
            You are logged in as <strong>{user.role}</strong>. Your AWG Construction CRM is ready.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <h3 className="font-semibold text-gray-900 mb-1">Bid Management</h3>
            <p className="text-sm text-gray-500">Capture and pre-analyze incoming bids</p>
            <p className="text-xs text-gray-400 mt-4">Coming soon</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-teal-500">
            <h3 className="font-semibold text-gray-900 mb-1">Takeoff</h3>
            <p className="text-sm text-gray-500">Extract quantities and measurements</p>
            <p className="text-xs text-gray-400 mt-4">Coming soon</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <h3 className="font-semibold text-gray-900 mb-1">Estimate</h3>
            <p className="text-sm text-gray-500">Create detailed estimates and proposals</p>
            <p className="text-xs text-gray-400 mt-4">Coming soon</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
            <h3 className="font-semibold text-gray-900 mb-1">Contract</h3>
            <p className="text-sm text-gray-500">Contract analysis and signature</p>
            <p className="text-xs text-gray-400 mt-4">Coming soon</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <h3 className="font-semibold text-gray-900 mb-1">Project Execution</h3>
            <p className="text-sm text-gray-500">WBS, progress, change orders</p>
            <p className="text-xs text-gray-400 mt-4">Coming soon</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-pink-500">
            <h3 className="font-semibold text-gray-900 mb-1">Financial</h3>
            <p className="text-sm text-gray-500">Billing and measurements</p>
            <p className="text-xs text-gray-400 mt-4">Coming soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}
