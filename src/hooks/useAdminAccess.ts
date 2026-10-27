import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getAdminAccess } from '../services/admin';

export function useAdminAccess(userId: string | undefined): boolean {
  const [access, setAccess] = useState<{ userId?: string; allowed: boolean }>({ allowed: false });
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const allowed = userId ? await getAdminAccess() : false;
      if (mounted) setAccess({ userId, allowed });
    };
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { mounted = false; subscription.remove(); };
  }, [userId]);
  return access.userId === userId && access.allowed;
}
