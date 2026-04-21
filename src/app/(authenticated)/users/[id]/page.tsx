'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Eye, EyeOff, Trash2 } from 'lucide-react';
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

type UserDetail = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleId: string;
  role: Role;
  modulePermissions: Array<{
    moduleId: string;
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    module: Module;
  }>;
};

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, rolesRes, modulesRes] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch('/api/roles'),
          fetch('/api/modules'),
        ]);

        if (!userRes.ok) {
          throw new Error('User not found');
        }

        const userData: UserDetail = await userRes.json();
        const rolesData: Role[] = await rolesRes.json();
        const modulesData: Module[] = await modulesRes.json();

        setName(userData.name);
        setEmail(userData.email);
        setRoleId(userData.roleId);
        setIsActive(userData.isActive);
        setRoles(rolesData);
        setModules(modulesData);

        // Merge existing permissions with all modules (fill missing with false)
        const existingByModule = new Map(
          userData.modulePermissions.map((p) => [p.moduleId, p])
        );
        setPermissions(
          modulesData.map((m) => {
            const existing = existingByModule.get(m.id);
            return {
              moduleId: m.id,
              canView: existing?.canView ?? false,
              canCreate: existing?.canCreate ?? false,
              canEdit: existing?.canEdit ?? false,
              canDelete: existing?.canDelete ?? false,
            };
          })
        );
      } catch (error: any) {
        toast.error(error.message || 'Failed to load user');
        router.push('/users');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId, router]);

  function togglePermission(
    moduleId: string,
    field: keyof Omit<Permission, 'moduleId'>
  ) {
    setPermissions((prev) =>
      prev.map((p) =>
        p.moduleId === moduleId ? { ...p, [field]: !p[field] } : p
      )
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

    if (!name || !email || !roleId) {
      toast.error('Please fill all required fields');
      return;
    }

    if (password && password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        name,
        email,
        roleId,
        isActive,
        permissions: permissions.filter(
          (p) => p.canView || p.canCreate || p.canEdit || p.canDelete
        ),
      };

      if (password && password.trim() !== '') {
        body.password = password;
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      toast.success('User updated successfully');
      router.push('/users');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate user');
      }

      toast.success('User deactivated');
      router.push('/users');
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate user');
      setDeactivating(false);
      setDeactivateDialogOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12 text-slate-500">Loading user...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/users">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to users
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">Edit User</h1>
          <p className="text-sm text-slate-500 mt-1">
            Update user information, role and module permissions
          </p>
        </div>
        {isActive && (
          <Button
            type="button"
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeactivateDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Deactivate
          </Button>
        )}
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
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Only fill this field if you want to change the password
                </p>
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

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="active-switch" className="text-sm font-medium">
                  Active account
                </Label>
                <p className="text-xs text-slate-500 mt-1">
                  Inactive users cannot sign in
                </p>
              </div>
              <Switch
                id="active-switch"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
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
                  perm.canView &&
                  perm.canCreate &&
                  perm.canEdit &&
                  perm.canDelete;

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
                        onCheckedChange={() =>
                          togglePermission(module.id, 'canView')
                        }
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={perm.canCreate}
                        onCheckedChange={() =>
                          togglePermission(module.id, 'canCreate')
                        }
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={perm.canEdit}
                        onCheckedChange={() =>
                          togglePermission(module.id, 'canEdit')
                        }
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <Checkbox
                        checked={perm.canDelete}
                        onCheckedChange={() =>
                          togglePermission(module.id, 'canDelete')
                        }
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-slate-500 mt-3 px-3">
                Tip: click a module name to toggle all permissions at once
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/users">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate user?</DialogTitle>
            <DialogDescription>
              {name} will no longer be able to sign in. You can reactivate this
              user later by editing them from the inactive list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
