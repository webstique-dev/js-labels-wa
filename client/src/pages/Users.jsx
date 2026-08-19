import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { UserPlus, Edit, Trash2, UserX, X, Shield, Search } from 'lucide-react';

const getRoleBadgeClass = (role) => {
  switch (role) {
    case 'super_admin': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'manager': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'caller': return 'bg-blue-50 text-blue-700 border-blue-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export default function Users() {
  const { user: currentUser, role: currentRole } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'caller',
    password: '',
    status: 'active'
  });

  // Deactivate Reassignment Modal State
  const [deactivateTargetUser, setDeactivateTargetUser] = useState(null);
  const [openItemsData, setOpenItemsData] = useState(null);
  const [reassignToId, setReassignToId] = useState('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/users', { params });
      setUsers(res.data || []);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error fetching users list');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, notify]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Form Modal Open
  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'caller',
      password: '',
      status: 'active'
    });
    setIsFormOpen(true);
  };

  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setFormData({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'caller',
      password: '',
      status: u.status || 'active'
    });
    setIsFormOpen(true);
  };

  // Submit Add / Edit User Form
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser._id}`, formData);
        notify.success(`User ${formData.name} updated successfully!`);
      } else {
        await api.post('/users', formData);
        notify.success(`User ${formData.name} created successfully!`);
      }
      setIsFormOpen(false);
      fetchUsers();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save user');
    }
  };

  // Handle Deactivate Action
  const handleDeactivate = async (u) => {
    try {
      const res = await api.patch(`/users/${u._id}/deactivate`);
      if (res.data.hasOpenItems) {
        setDeactivateTargetUser(u);
        setOpenItemsData(res.data);
        const activeOtherUsers = users.filter(usr => usr._id !== u._id && usr.status === 'active');
        setReassignToId(activeOtherUsers[0]?._id || '');
      } else {
        const isConfirmed = await confirm({
          title: 'Deactivate User Account',
          message: `Are you sure you want to deactivate account for "${u.name}"?`,
          confirmLabel: 'Deactivate',
          cancelLabel: 'Cancel',
          variant: 'danger'
        });

        if (isConfirmed) {
          notify.info(`User ${u.name} deactivated`);
          fetchUsers();
        }
      }
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error checking user open items');
    }
  };

  // Handle Soft Delete User Action
  const handleDeleteUser = async (u) => {
    const isConfirmed = await confirm({
      title: 'Move User to Trash',
      message: `Are you sure you want to soft-delete user "${u.name}"? The user account will be moved to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/users/${u._id}`);
      notify.success(`User "${u.name}" moved to Trash`);
      fetchUsers();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  // Submit Reassign and Deactivate
  const handleReassignAndDeactivateSubmit = async (e) => {
    e.preventDefault();
    if (!deactivateTargetUser || !reassignToId) return;

    try {
      setIsSubmittingReassign(true);
      const res = await api.post(`/users/${deactivateTargetUser._id}/reassign-and-deactivate`, {
        reassignTo: reassignToId
      });
      notify.success(res.data.message || 'User deactivated and items reassigned!');
      setDeactivateTargetUser(null);
      setOpenItemsData(null);
      fetchUsers();
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to reassign and deactivate user');
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Management & Accounts</h1>
          <p className="text-slate-500 text-sm mt-1">Manage team accounts, role privileges, caller status, and lead reassignments</p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2"
        >
          <UserPlus size={16} />
          <span>Add User</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="manager">Manager</option>
            <option value="caller">Caller Executive</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {(roleFilter || statusFilter) && (
          <button
            onClick={() => {
              setRoleFilter('');
              setStatusFilter('');
            }}
            className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
          >
            <X size={14} />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Main Users Table View */}
      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Loading Users Database...</p>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 space-y-2">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <UserX size={24} />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No Users Found</h3>
          <p className="text-xs text-slate-400">No user accounts match the selected filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">User Name</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Role Privilege</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Last Active</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-bold text-slate-900 text-sm">
                      {u.name}
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-slate-800 block">{u.email}</span>
                      <span className="text-slate-400 text-[11px] block">{u.phone || 'No phone'}</span>
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-1 border text-[11px] font-extrabold rounded-lg uppercase ${getRoleBadgeClass(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-0.5 border text-[10px] font-bold rounded uppercase ${
                        u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {u.status}
                      </span>
                    </td>

                    <td className="p-4 font-semibold text-slate-600">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg transition inline-flex items-center gap-1"
                      >
                        <Edit size={12} />
                        <span>Edit</span>
                      </button>
                      {u.status === 'active' && (
                        <button
                          onClick={() => handleDeactivate(u)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg transition inline-flex items-center gap-1"
                        >
                          <UserX size={12} />
                          <span>Deactivate</span>
                        </button>
                      )}
                      {currentRole === 'super_admin' && u._id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center"
                          title="Move User to Trash"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden space-y-3">
            {users.map((u) => (
              <div key={u._id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-black text-slate-900 text-sm">{u.name}</span>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 border text-[10px] font-extrabold rounded uppercase ${getRoleBadgeClass(u.role)}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className={`px-2 py-0.5 border text-[10px] font-bold rounded uppercase ${
                    u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {u.status}
                  </span>

                  <div className="space-x-1 flex items-center">
                    <button
                      onClick={() => handleOpenEditModal(u)}
                      className="px-2.5 py-1 bg-slate-100 text-slate-800 font-bold text-[10px] rounded-lg"
                    >
                      Edit
                    </button>
                    {u.status === 'active' && (
                      <button
                        onClick={() => handleDeactivate(u)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold text-[10px] rounded-lg"
                      >
                        Deactivate
                      </button>
                    )}
                    {currentRole === 'super_admin' && u._id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add / Edit User Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingUser ? `Edit Account: ${editingUser.name}` : 'Create New User Account'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ramesh@jslabels.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role Privilege *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                  >
                    <option value="caller">Caller Executive</option>
                    <option value="manager">Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep existing)' : 'Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Reassignment Prompt Modal */}
      {deactivateTargetUser && openItemsData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-rose-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3 text-rose-600">
              <h3 className="text-base font-extrabold">Reassignment Required</h3>
              <button
                onClick={() => setDeactivateTargetUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReassignAndDeactivateSubmit} className="space-y-4">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-bold">
                  User {deactivateTargetUser.name} has active items assigned:
                </p>
                <ul className="list-disc list-inside font-semibold space-y-0.5">
                  <li>{openItemsData.openLeadsCount} Open Lead(s)</li>
                  <li>{openItemsData.openFollowUpsCount} Open Follow-up(s)</li>
                </ul>
                <p className="text-[11px] text-rose-600 mt-1">
                  Please select an active executive to reassign these items before deactivating the account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reassign All Items To *</label>
                <select
                  required
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500"
                >
                  <option value="">-- Choose Target Executive --</option>
                  {users.filter(usr => usr._id !== deactivateTargetUser._id && usr.status === 'active').map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.role.replace('_', ' ')}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeactivateTargetUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingReassign ? 'Reassigning...' : 'Reassign & Deactivate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
