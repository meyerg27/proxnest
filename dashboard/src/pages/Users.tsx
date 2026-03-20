import { useApi } from '@/hooks/useApi';
import { users as usersApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, Shield, User, Eye, Trash2, MoreVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import type { User as UserType } from '@/types/api';

const roleConfig = {
  admin: { icon: Shield, color: 'text-amber-400 bg-amber-500/10', label: 'Admin' },
  user: { icon: User, color: 'text-nest-300 bg-nest-800/50', label: 'User' },
  viewer: { icon: Eye, color: 'text-nest-400 bg-nest-800/30', label: 'Viewer' },
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data, loading, refetch } = useApi(() => usersApi.list());
  const [deleting, setDeleting] = useState<number | null>(null);

  const userList = (data as { users: UserType[] } | null)?.users || [];
  const isAdmin = currentUser?.role === 'admin';

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await usersApi.remove(id);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-nest-400 border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <Shield size={48} className="mx-auto text-nest-600 mb-3" />
        <p className="text-white font-medium">Admin Access Required</p>
        <p className="text-sm text-nest-400 mt-1">Only administrators can manage users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-nest-400">{userList.length} user{userList.length !== 1 ? 's' : ''}</p>
      </div>

      {/* User table */}
      <div className="glass rounded-xl overflow-hidden glow-border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-nest-400/10">
                <th className="text-left text-xs font-medium text-nest-400 px-6 py-3 uppercase tracking-wider">User</th>
                <th className="text-left text-xs font-medium text-nest-400 px-6 py-3 uppercase tracking-wider">Role</th>
                <th className="text-left text-xs font-medium text-nest-400 px-6 py-3 uppercase tracking-wider hidden sm:table-cell">Email</th>
                <th className="text-left text-xs font-medium text-nest-400 px-6 py-3 uppercase tracking-wider hidden md:table-cell">Last Login</th>
                <th className="text-right text-xs font-medium text-nest-400 px-6 py-3 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => {
                const role = roleConfig[u.role] || roleConfig.viewer;
                const RoleIcon = role.icon;
                const isSelf = u.id === currentUser?.id;

                return (
                  <tr key={u.id} className="border-b border-nest-400/5 hover:bg-nest-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-nest-700 text-xs font-bold uppercase text-white">
                          {u.display_name?.[0] || u.username[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {u.display_name || u.username}
                            {isSelf && <span className="text-nest-400 text-xs ml-2">(you)</span>}
                          </p>
                          <p className="text-xs text-nest-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium', role.color)}>
                        <RoleIcon size={12} />
                        {role.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-nest-300">{u.email}</span>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className="text-xs text-nest-400">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          disabled={deleting === u.id}
                          className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
