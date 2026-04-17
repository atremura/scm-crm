import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Building2, Users, FileText, Plus } from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as any;

  // Fetch stats from database
  const [bidCount, clientCount, userCount] = await Promise.all([
    prisma.bid.count(),
    prisma.client.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {user.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Here is an overview of your CRM activity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Active Bids
            </CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{bidCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              {bidCount === 0 ? 'No bids yet' : 'Open opportunities'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Clients
            </CardTitle>
            <Building2 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{clientCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              {clientCount === 0 ? 'No clients yet' : 'Registered clients'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Users
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{userCount}</div>
            <p className="text-xs text-slate-500 mt-1">
              {userCount === 1 ? 'Just you' : 'Active users'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/clients">
                <Plus className="h-4 w-4 mr-1" />
                New Client
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/users">
                <Plus className="h-4 w-4 mr-1" />
                New User
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/bids">
                <FileText className="h-4 w-4 mr-1" />
                View Bids
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}