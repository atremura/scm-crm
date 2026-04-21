'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type Module = {
  id: string;
  name: string;
  slug: string;
};

type Permission = {
  moduleId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export default function NewUserPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);

  // Dropdowns data
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  useEffect(() => {
    async function loadDropdowns() {
      try {
        const [rolesRes, modulesRes] = await Promise.all([
          fetch('/api/roles'),
          fetch('/api/modules'),
        ]);
        const rolesData = await rolesRes.json();
        const modulesData = await modulesRes.json();
        setRoles(rolesData);
        setModules(modulesData);

        // Initialize permissions for each module (all false)
        setPermissions(
          modulesData.map((m: Module) => ({
            moduleId: m.id,
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          }))
        );
      } catch (error) {
        toast.error('Failed to load form data');
      } finally {
        setLoadingDropdowns(false);
      }
    }
    loadDropdowns();
  }, []);

  function togglePermission(moduleId: string, field: keyof Omit<Permission, 'moduleId'>) {
    setPermissions((prev) =>
      prev.map((p) => (p.moduleId === moduleId ? { ...p, [field]: !p[field] } : p))
    );
  }

  function toggleAllForModule(moduleId: string, value: boolean) {
    setPermissions((prev) =>
      prev.map((p) =>
        p.moduleId === moduleId
          ? {
              ...p,
              canView: value,
              canCreate: value,
              canEdit: value,
              canDelete: value,
            }
          : p
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !email || !password || !roleId) {
      toast.error('Please fill all required fields');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          roleId,
          permissions: permissions.filter(
            (p) => p.canView || p.canCreate || p.canEdit || p.canDelete
          ),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success('User created successfully');
      router.push('/users');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/users">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to users
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-slate-900">New User</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create a new user and assign their module permissions
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>User account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@awgconstructions.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select value={roleId} onValueChange={setRoleId} required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Module Permissions</CardTitle>
            <CardDescription>
              Define what this user can do in each module
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDropdowns ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-medium text-slate-500 uppercase tracking-wider border-b">
                  <div className="col-span-4">Module</div>
                  <div className="col-span-2 text-center">View</div>
                  <div className="col-span-2 text-center">Create</div>
                  <div className="col-span-2 text-center">Edit</div>
                  <div className="col-span-2 text-center">Delete</div>
                </div>
                {modules.map((module) => {
                  const perm = permissions.find((p) => p.moduleId === module.id);
                  if (!perm) return null;
                  const allChecked =
                    perm.canView && perm.canCreate && perm.canEdit && perm.canDelete;

                  return (
                    <div
                      key={module.id}
                      className="grid grid-cols-12 gap-2 px-3 py-3 hover:bg-slate-50 rounded-md items-center"
                    >
                      <div className="col-span-4">
                        <button
                          type="button"
                          onClick={() => toggleAllForModule(module.id, !allChecked)}
                          className="text-sm font-medium text-slate-700 hover:text-blue-600 text-left"
                        >
                          {module.name}
                        </button>
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Checkbox
                          checked={perm.canView}
                          onCheckedChange={() => togglePermission(module.id, 'canView')}
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Checkbox
                          checked={perm.canCreate}
                          onCheckedChange={() => togglePermission(module.id, 'canCreate')}
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Checkbox
                          checked={perm.canEdit}
                          onCheckedChange={() => togglePermission(module.id, 'canEdit')}
                        />
                      </div>
                      <div className="col-span-2 flex justify-center">
                        <Checkbox
                          checked={perm.canDelete}
                          onCheckedChange={() => togglePermission(module.id, 'canDelete')}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-slate-500 mt-3 px-3">
                  Tip: click a module name to toggle all permissions at once
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/users">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </form>
    </div>
  );
}