import { toast } from 'sonner';

export type ClassificationScope = 'service' | 'service_and_material';

export async function toggleClassificationScope(
  projectId: string,
  classificationId: string,
  currentScope: string,
): Promise<boolean> {
  const newScope: ClassificationScope =
    currentScope === 'service' ? 'service_and_material' : 'service';

  const res = await fetch(`/api/projects/${projectId}/classifications/${classificationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: newScope }),
  });

  if (!res.ok) {
    toast.error('Failed to change scope');
    return false;
  }

  toast.success(`Scope: ${newScope === 'service' ? 'Service only' : 'Service + Material'}`);
  return true;
}
