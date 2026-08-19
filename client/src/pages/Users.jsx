import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  UserPlus,
  Edit,
  Trash2,
  UserX,
  UserCheck,
  X,
  Shield,
  Key,
  Eye,
  EyeOff,
  Lock
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';

export default function Users() {
  const { user: currentUser, role: currentRole } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  // Form State for Add/Edit User
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'caller',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Deactivate Reassignment State
  const [deactivateTargetUser, setDeactivateTargetUser] = useState(null);
  const [openItemsData, setOpenItemsData] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  const loggedInUserId = currentUser?.id || currentUser?._id;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/users', { params });
      setUsers(res.data || []);
    } catch (err) {
      console.error('Error fetching users list:', err);
      notify.error(err.response?.data?.message || 'Error fetching users list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter]);

  const handleOpenAddModal = () => {
    setIsEdit(false);
    setEditUserId(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'caller',
      password: ''
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (u) => {
    setIsEdit(true);
    setEditUserId(u._id);
    setFormData({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || 'caller',
      password: ''
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      if (isEdit) {
        const payload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role
        };
        if (formData.password) payload.password = formData.password;

        await api.patch(`/users/${editUserId}`, payload);
        notify.success('User updated successfully!');
      } else {
        if (!formData.password || formData.password.length < 6) {
          notify.error('Password must be at least 6 characters long');
          setIsSubmitting(false);
          return;
        }
        await api.post('/users', formData);
        notify.success('User created successfully!');
      }

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      notify.error(err.response?.data?.message || 'Failed to save user details');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Activate User Handler
  const handleActivateUser = async (u) => {
    const isConfirmed = await confirm({
      title: 'Activate User Account',
      message: `Are you sure you want to activate user "${u.name}"?`,
      confirmLabel: 'Activate User',
      cancelLabel: 'Cancel',
      variant: 'default'
    });

    if (!isConfirmed) return;

    try {
      const res = await api.patch(`/users/${u._id}/activate`);
      notify.success(res.data?.message || `Activated user ${u.name}`);
      fetchUsers();
    } catch (err) {
      console.error('Error activating user:', err);
      notify.error(err.response?.data?.message || 'Error activating user');
    }
  };

  // Deactivate User Handler
  const handleDeactivate = async (u) => {
    const isConfirmed = await confirm({
      title: 'Deactivate User Account',
      message: `Are you sure you want to deactivate user "${u.name}"?`,
      confirmLabel: 'Deactivate User',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      const res = await api.patch(`/users/${u._id}/deactivate`);
      if (res.data.hasOpenItems) {
        setDeactivateTargetUser(u);
        setOpenItemsData(res.data);
        const firstCaller = users.find(c => c._id !== u._id && c.status === 'active' && c.role === 'caller');
        setReassignTo(firstCaller ? firstCaller._id : '');
      } else {
        notify.success(`Deactivated user ${u.name}`);
        fetchUsers();
      }
    } catch (err) {
      console.error('Error deactivating user:', err);
      notify.error(err.response?.data?.message || 'Error deactivating user');
    }
  };

  // Open Update Password Modal
  const handleOpenPasswordModal = (u) => {
    setPasswordUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  // Submit Password Update
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      notify.error('Password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error('Passwords do not match. Please verify.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await api.patch(`/users/${passwordUser._id}/password`, { password: newPassword });
      notify.success(`Password for ${passwordUser.name} updated successfully!`);
      setShowPasswordModal(false);
      setPasswordUser(null);
    } catch (err) {
      console.error('Error updating password:', err);
      notify.error(err.response?.data?.message || 'Failed to update user password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Move User to Trash (Soft Delete)
  const handleDeleteUser = async (u) => {
    const isConfirmed = await confirm({
      title: 'Move User to Trash',
      message: `Are you sure you want to soft delete user "${u.name}"? They will be moved to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/users/${u._id}`);
      notify.success(`User "${u.name}" deleted successfully`);
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      notify.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  // Reassign and Deactivate Submit
  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignTo || !deactivateTargetUser) return;

    try {
      setIsSubmittingReassign(true);
      const res = await api.post(`/users/${deactivateTargetUser._id}/reassign-and-deactivate`, {
        reassignTo
      });
      notify.success(res.data.message || 'User deactivated and items reassigned!');
      setDeactivateTargetUser(null);
      setOpenItemsData(null);
      fetchUsers();
    } catch (err) {
      console.error('Error reassigning user items:', err);
      notify.error(err.response?.data?.message || 'Failed to reassign and deactivate user');
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const getRoleBadgeClass = (roleStr) => {
    switch (roleStr) {
      case 'super_admin':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'manager':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">User Management & Accounts</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Manage team accounts, role privileges, caller status, and lead reassignments</p>
        </div>

        {currentRole === 'super_admin' && (
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Add User</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="manager">Manager</option>
            <option value="caller">Caller</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="text-slate-900 font-semibold">{users.length}</span> team accounts
        </div>
      </div>

      {/* Users List / Table */}
      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : users.length === 0 ? (
        <div className="min-h-[250px] bg-white rounded-2xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
            <UserX size={24} />
          </div>
          <h3 className="font-semibold text-slate-800 text-sm">No Users Found</h3>
          <p className="text-xs text-slate-400 font-normal">No user accounts match the selected filter criteria.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">User Name</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Role Privilege</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Last Active</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {users.map((u) => {
                  const isSelf = loggedInUserId && loggedInUserId.toString() === u._id.toString();

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-semibold text-slate-900 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Logged-in User
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="font-medium text-slate-800 block">{u.email}</span>
                        <span className="text-slate-400 text-[11px] block">{u.phone || 'No phone'}</span>
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 border text-[11px] font-medium rounded-lg uppercase ${getRoleBadgeClass(u.role)}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 border text-[10px] font-medium rounded uppercase ${
                          u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {u.status}
                        </span>
                      </td>

                      <td className="p-4 font-medium text-slate-600">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : 'Never'}
                      </td>

                      <td className="p-4 text-right">
                        {/* Requirement: If logged-in user is Super Admin, leave Actions completely empty for their own row */}
                        {isSelf ? null : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[11px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                              title="Edit User Details"
                            >
                              <Edit size={12} />
                              <span>Edit</span>
                            </button>

                            {/* Activate / Deactivate Toggle */}
                            {u.status === 'active' ? (
                              <button
                                onClick={() => handleDeactivate(u)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-[11px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                title="Deactivate Account"
                              >
                                <UserX size={12} />
                                <span>Deactivate</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivateUser(u)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium text-[11px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                title="Activate Account"
                              >
                                <UserCheck size={12} />
                                <span>Activate</span>
                              </button>
                            )}

                            {/* Update Password Button */}
                            <button
                              onClick={() => handleOpenPasswordModal(u)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-[11px] rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                              title="Update User Password"
                            >
                              <Key size={12} />
                              <span>Password</span>
                            </button>

                            {/* Delete Button */}
                            {currentRole === 'super_admin' && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center cursor-pointer"
                                title="Move User to Trash"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards View */}
          <div className="md:hidden space-y-3">
            {users.map((u) => {
              const isSelf = loggedInUserId && loggedInUserId.toString() === u._id.toString();

              return (
                <div key={u._id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                        {u.name}
                        {isSelf && <span className="text-[10px] font-normal text-slate-400">(You)</span>}
                      </span>
                      <p className="text-xs text-slate-500 font-normal">{u.email}</p>
                    </div>
                    <span className={`px-2 py-0.5 border text-[10px] font-medium rounded uppercase ${getRoleBadgeClass(u.role)}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className={`px-2 py-0.5 border text-[10px] font-medium rounded uppercase ${
                      u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {u.status}
                    </span>

                    {/* Actions on Mobile */}
                    {!isSelf && (
                      <div className="space-x-1 flex items-center flex-wrap gap-1">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="px-2 py-1 bg-slate-100 text-slate-800 font-medium text-[10px] rounded-lg"
                        >
                          Edit
                        </button>
                        {u.status === 'active' ? (
                          <button
                            onClick={() => handleDeactivate(u)}
                            className="px-2 py-1 bg-rose-50 text-rose-700 font-medium text-[10px] rounded-lg"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivateUser(u)}
                            className="px-2 py-1 bg-emerald-50 text-emerald-700 font-medium text-[10px] rounded-lg"
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenPasswordModal(u)}
                          className="px-2 py-1 bg-blue-50 text-blue-700 font-medium text-[10px] rounded-lg"
                        >
                          Password
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">
                {isEdit ? 'Edit User Details' : 'Create New User Account'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@jslabels.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Role Privilege *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 cursor-pointer"
                >
                  <option value="caller">Caller (Tele Executive)</option>
                  <option value="manager">Manager (Sales Team Lead)</option>
                  <option value="super_admin">Super Admin (System Administrator)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {isEdit ? 'New Password (optional - leave blank to keep current)' : 'Account Password *'}
                </label>
                <input
                  type="password"
                  required={!isEdit}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Password Dedicated Modal */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Key size={16} className="text-blue-600" />
                <span>Update Password for {passwordUser.name}</span>
              </h3>
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordUser(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-normal">
              Target Account: <strong className="text-slate-900">{passwordUser.email}</strong>
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">New Password *</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 text-slate-400" size={16} />
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Confirm New Password *</label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 text-slate-400" size={16} />
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowPasswordModal(false); setPasswordUser(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Reassignment Modal */}
      {deactivateTargetUser && openItemsData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Reassignment Required</h3>
              <button
                onClick={() => { setDeactivateTargetUser(null); setOpenItemsData(null); }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 font-normal">
              User <span className="font-semibold text-slate-900">{deactivateTargetUser.name}</span> currently has assigned items:
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-amber-900">Open Leads: {openItemsData.openLeadsCount}</p>
              <p className="font-semibold text-amber-900">Open Follow-ups: {openItemsData.openFollowupsCount}</p>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Reassign All Items To:</label>
                <select
                  required
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 cursor-pointer"
                >
                  <option value="">Select active executive caller...</option>
                  {users
                    .filter(c => c._id !== deactivateTargetUser._id && c.status === 'active')
                    .map(caller => (
                      <option key={caller._id} value={caller._id}>
                        {caller.name} ({caller.role})
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setDeactivateTargetUser(null); setOpenItemsData(null); }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign || !reassignTo}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReassign ? 'Processing...' : 'Reassign & Deactivate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
