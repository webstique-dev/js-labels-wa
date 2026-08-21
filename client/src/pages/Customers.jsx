import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Users, Search, Trash2, ArrowRight, Phone, Mail, Building, Plus, X } from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';

export default function Customers() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    city: '',
    gstNo: '',
    customerType: 'Distributor'
  });

  const canDelete = role === 'super_admin';

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const url = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
      const res = await api.get(url);

      let customerList = [];
      if (Array.isArray(res.data)) {
        customerList = res.data;
      } else if (res.data && Array.isArray(res.data.customers)) {
        customerList = res.data.customers;
      }

      setCustomers(customerList);
    } catch (err) {
      console.error('Error fetching customers:', err);
      notify.error(err.response?.data?.message || 'Failed to load customer directory');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();

    const cleanPhone = (formData.phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      notify.error('Phone number must be exactly 10 digits');
      return;
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        notify.error('Please enter a valid email address');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        phone: cleanPhone,
        email: formData.email ? formData.email.trim().toLowerCase() : undefined
      };
      const res = await api.post('/customers', payload);
      notify.success('New customer account created successfully!');
      setShowAddModal(false);
      setFormData({ name: '', company: '', phone: '', email: '', city: '', gstNo: '', customerType: 'Distributor' });
      fetchCustomers();
      if (res.data && res.data._id) {
        navigate(`/customers/${res.data._id}`);
      }
    } catch (err) {
      console.error('Error creating customer:', err);
      notify.error(err.response?.data?.message || 'Failed to create customer profile');
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleDeleteCustomer = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Move Customer to Trash',
      message: `Are you sure you want to soft delete customer "${name}"? It will be moved to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/customers/${id}`);
      notify.success(`Customer "${name}" moved to Trash`);
      fetchCustomers();
    } catch (err) {
      console.error('Error deleting customer:', err);
      notify.error(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const getProbabilityBadgeClass = (score) => {
    if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const getInitials = (name) => {
    if (!name) return 'JS';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const safeCustomers = Array.isArray(customers) ? customers : [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Manage customer accounts, reorder predictions, and purchasing history</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, city..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <Search size={16} className="text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            onClick={() => {
              setFormData({ name: '', company: '', phone: '', email: '', city: '', gstNo: '', customerType: 'Distributor' });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : safeCustomers.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Users size={24} />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">No Customers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-normal">
            {search ? 'No customer accounts match your search query.' : 'There are no active customer accounts in the database.'}
          </p>
          <button
            onClick={() => {
              setFormData({ name: '', company: '', phone: '', email: '', city: '', gstNo: '', customerType: 'Distributor' });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Customer / Company</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Sales Executive</th>
                  <th className="p-4">Reorder Probability</th>
                  <th className="p-4">Expected Reorder Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {safeCustomers.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => navigate(`/customers/${c._id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{c.name}</p>
                          <p className="text-slate-500 text-[11px] font-normal">{c.company || 'Individual'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <p className="font-medium text-slate-800">{c.phone}</p>
                      <p className="text-slate-400 text-[11px] font-normal">{c.email || c.city || 'N/A'}</p>
                    </td>

                    <td className="p-4 font-medium text-slate-700">
                      {c.salesExecutive?.name || 'Unassigned'}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.reorderProbability >= 80
                                ? 'bg-emerald-500'
                                : c.reorderProbability >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                            style={{ width: `${c.reorderProbability || 75}%` }}
                          ></div>
                        </div>
                        <span
                          className={`px-2 py-0.5 border text-[10px] font-medium rounded-md uppercase ${getProbabilityBadgeClass(
                            c.reorderProbability || 75
                          )}`}
                        >
                          {c.reorderProbability || 75}%
                        </span>
                      </div>
                    </td>

                    <td className="p-4 font-medium text-slate-800">
                      {c.expectedReorderDate
                        ? new Date(c.expectedReorderDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                        : 'Jun 12, 2025'}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={`Delete ${c.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(c._id, c.name);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${c._id}`);
                          }}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl border border-red-200 text-xs transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View 360°</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="md:hidden space-y-3">
            {safeCustomers.map((c) => (
              <div
                key={c._id}
                onClick={() => navigate(`/customers/${c._id}`)}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs active:bg-slate-50 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
                      {getInitials(c.name)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{c.name}</h4>
                      <p className="text-slate-500 text-xs font-normal">{c.company || 'Individual'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={`Delete ${c.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomer(c._id, c.name);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span
                      className={`px-2 py-0.5 border text-[10px] font-medium rounded-md uppercase ${getProbabilityBadgeClass(
                        c.reorderProbability || 75
                      )}`}
                    >
                      {c.reorderProbability || 75}% Reorder
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-normal">{c.phone}</span>
                  <span className="font-medium text-slate-700">
                    {c.expectedReorderDate ? new Date(c.expectedReorderDate).toLocaleDateString('en-IN') : 'Jun 12, 2025'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Add New Customer Account</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Acme Corporation"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Phone Number *</label>
                    {/* <span className={`text-[10px] ${formData.phone.length === 10 ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                      {formData.phone.length}/10 digits
                    </span> */}
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {formData.phone && formData.phone.length !== 10 && (
                    <p className="text-[10px] text-rose-500 font-medium mt-1">Must be 10 digits</p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Chennai"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john.doe@company.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900"
                />
              </div>

              <div className="flex justify-end items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
