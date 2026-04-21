import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

/**
 * Returns the authenticated user or null.
 */
export async function requireAuth(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as { id: string; email: string; name: string; role: string };
  return {
    userId: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
  };
}

/**
 * Checks whether the given user can perform an action on a module.
 * Admins always get a yes. Otherwise reads user_module_permissions.
 */
export async function canDo(
  ctx: AuthContext,
  moduleSlug: string,
  action: PermissionAction
): Promise<boolean> {
  if (ctx.role === 'Admin') return true;

  const perm = await prisma.userModulePermission.findFirst({
    where: {
      userId: ctx.userId,
      module: { slug: moduleSlug },
    },
    select: {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
    },
  });

  if (!perm) return false;

  switch (action) {
    case 'view':
      return perm.canView;
    case 'create':
      return perm.canCreate;
    case 'edit':
      return perm.canEdit;
    case 'delete':
      return perm.canDelete;
  }
}
