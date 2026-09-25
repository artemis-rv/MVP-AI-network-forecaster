import { useState } from 'react';
import { 
  Search, Plus, 
  Edit2, Power, X, Check, KeyRound, Shield, Trash2
} from 'lucide-react';
import { useAppStore, UserAccount } from '@/store/appStore';

export function UserManagementPage() {
  const { users, addUser, updateUser, toggleUserStatus, deleteUser, currentUser, addToast } = useAppStore();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Admin' | 'SOC Analyst'>('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  
  const filteredUsers = users.filter(u => 
    (roleFilter === 'ALL' || u.role === roleFilter) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string).trim();
    const email = (formData.get('email') as string).trim().toLowerCase();
    const password = (formData.get('password') as string)?.trim();
    const role = formData.get('role') as 'Admin' | 'SOC Analyst';
    const status = formData.get('status') as 'Active' | 'Disabled';

    if (editingUser) {
      updateUser(editingUser.id, {
        name,
        email,
        role,
        status,
        ...(password ? { password } : {})
      });
      addToast(`Updated user account ${name}`, 'success');
    } else {
      addUser({
        name,
        email,
        password: password || 'nextrace123',
        role,
        status,
      });
      addToast(`Created user account for ${name} (${email})`, 'success');
    }
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleToggleStatus = (user: UserAccount) => {
    if (currentUser?.id === user.id) {
      alert("You cannot disable your own active administrator account.");
      return;
    }
    const newStatus = user.status === 'Active' ? 'Disabled' : 'Active';
    if (confirm(`Change status of "${user.name}" to ${newStatus}?`)) {
      toggleUserStatus(user.id);
      addToast(`User ${user.name} is now ${newStatus}`, newStatus === 'Active' ? 'success' : 'warning');
    }
  };

  const handleDelete = (user: UserAccount) => {
    if (currentUser?.id === user.id) {
      alert("You cannot delete your own active administrator account.");
      return;
    }
    if (confirm(`Are you sure you want to permanently delete user "${user.name}"?`)) {
      deleteUser(user.id);
      addToast(`Deleted user ${user.name}`, 'info');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>User Management</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Live directory of accounts authorized to sign in to NextRace AI ({users.length} registered users).
            </p>
          </div>
          <button 
            onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <Plus size={16} /> Add User
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 300 }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>
          <select 
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
          >
            <option value="ALL">All Roles ({users.length})</option>
            <option value="Admin">Admin ({users.filter(u => u.role === 'Admin').length})</option>
            <option value="SOC Analyst">SOC Analyst ({users.filter(u => u.role === 'SOC Analyst').length})</option>
          </select>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Showing {filteredUsers.length} of {users.length} accounts
          </div>
        </div>

        {/* User Table */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-workspace)', borderBottom: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>User / Identity</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Login Credential</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Active</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, i) => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <tr key={u.id} style={{ borderBottom: i === filteredUsers.length - 1 ? 'none' : '1px solid var(--border-subtle)', background: 'white' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 8,
                          background: u.role === 'Admin' ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)',
                          color: u.role === 'Admin' ? 'var(--primary)' : '#2563eb',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12
                        }}>
                          {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {u.name}
                            {isCurrent && (
                              <span style={{ fontSize: 10, background: 'var(--primary)', color: 'white', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                YOU
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        background: u.role === 'Admin' ? 'var(--primary-light)' : 'var(--bg-workspace)', 
                        color: u.role === 'Admin' ? 'var(--primary)' : 'var(--text-secondary)',
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}>
                        <Shield size={12} />
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ 
                        background: u.status === 'Active' ? 'var(--color-safe-light)' : 'rgba(239,68,68,0.1)', 
                        color: u.status === 'Active' ? 'var(--color-safe)' : '#dc2626',
                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700 
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-workspace)', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        <KeyRound size={12} color="var(--text-muted)" />
                        <span>{u.password || '••••••••'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-muted)' }}>
                      <span style={{ color: u.lastActive === 'Just now' ? 'var(--color-safe)' : 'var(--text-muted)', fontWeight: u.lastActive === 'Just now' ? 600 : 400 }}>
                        {u.lastActive}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button 
                          title="Edit User"
                          onClick={() => { setEditingUser(u); setIsModalOpen(true); }} 
                          style={{ background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)', padding: 6, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          title={u.status === 'Active' ? 'Deactivate User' : 'Activate User'}
                          onClick={() => handleToggleStatus(u)} 
                          style={{ background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)', padding: 6, borderRadius: 6, cursor: 'pointer', color: u.status === 'Active' ? '#dc2626' : 'var(--color-safe)' }}
                        >
                          <Power size={14} />
                        </button>
                        {!isCurrent && (
                          <button 
                            title="Delete User"
                            onClick={() => handleDelete(u)} 
                            style={{ background: 'var(--bg-workspace)', border: '1px solid var(--border-subtle)', padding: 6, borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
          <form onSubmit={handleSaveUser} style={{ background: 'white', width: 440, borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-workspace)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingUser ? 'Edit User Credentials' : 'Add New User'}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Full Name</label>
                <input name="name" required defaultValue={editingUser?.name} placeholder="e.g. John Doe" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Email Address (Login Username)</label>
                <input name="email" type="email" required defaultValue={editingUser?.email} placeholder="e.g. john@nextrace.ai" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Password {editingUser && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(leave unchanged to keep current)</span>}
                </label>
                <input 
                  name="password" 
                  type="text" 
                  defaultValue={editingUser?.password || ''} 
                  placeholder={editingUser ? 'Leave blank or enter new password' : 'Enter password (e.g. soc123)'} 
                  required={!editingUser}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Role</label>
                  <select name="role" defaultValue={editingUser?.role || 'SOC Analyst'} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="SOC Analyst">SOC Analyst</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Status</label>
                  <select name="status" defaultValue={editingUser?.status || 'Active'} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default)', outline: 'none', boxSizing: 'border-box' }}>
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Permission Matrix Preview */}
              <div style={{ marginTop: 6, padding: 12, background: 'var(--bg-workspace)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Account Access Privileges</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><Check size={12} color="var(--color-safe)" /> Validated against actual login screen</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><Check size={12} color="var(--color-safe)" /> Enforces Active / Disabled session status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}><Check size={12} color="var(--color-safe)" /> Session persisted until tab is closed</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-workspace)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Save Account</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
