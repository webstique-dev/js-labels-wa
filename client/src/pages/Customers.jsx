import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Search,
  ArrowRight,
  Trash2,
  Building2,
  Users
} from 'lucide-react';

const getInitials = (name) => {
  if (!name) return 'CU';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const getProbabilityBadgeClass = (prob) => {
  if (prob >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (prob >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
};

export default function Customers() {
  const navigate = useNavigate();
  const { user, role, permissions } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canDelete = permissions.customers?.includes('delete') || role === 'super_admin' || role === 'manager';

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers', { params: { search } });
      setCustomers(res.data.customers || []);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Error fetching customers');
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleDeleteCustomer = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Move Customer to Trash',
      message: `Are you sure you want to soft-delete customer "${name}"? Historical orders will be preserved.`,
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
      notify.error(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Search Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer accounts, reorder predictions, and purchasing history</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, city..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <Search size={16} className="text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="min-h-[400px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 text-xs font-semibold">Loading Customer Accounts...</p>
          </div>
        </div>
      ) : customers.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Users size={24} />
          </div>
          <h3 className="font-bold text-slate-800 text-base">No Customers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? 'No customer accounts match your search query.' : 'There are no active customer accounts in the database.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <th className="p-4">Customer / Company</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Sales Executive</th>
                  <th className="p-4">Reorder Probability</th>
                  <th className="p-4">Expected Reorder Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {customers.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => navigate(`/customers/${c._id}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-slate-500 text-[11px]">{c.company || 'Individual'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <p className="font-semibold text-slate-800">{c.phone}</p>
                      <p className="text-slate-400 text-[11px]">{c.email || c.city || 'N/A'}</p>
                    </td>

                    <td className="p-4 font-semibold text-slate-700">
                      {c.salesExecutive?.name || 'Unassigned'}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.reorderProbability >= 80
                                ? 'bg-emerald-500'
                                : c.reorderProbability >= 50
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${c.reorderProbability}%` }}
                          ></div>
                        </div>
                        <span
                          className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase ${getProbabilityBadgeClass(
                            c.reorderProbability
                          )}`}
                        >
                          {c.reorderProbability}%
                        </span>
                      </div>
                    </td>

                    <td className="p-4 font-semibold text-slate-800">
                      {c.expectedReorderDate
                        ? new Date(c.expectedReorderDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/customers/${c._id}`);
                        }}
                        className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 text-xs transition inline-flex items-center gap-1"
                      >
                        <span>View 360°</span>
                        <ArrowRight size={12} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(c._id, c.name);
                          }}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center"
                          title="Move to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="md:hidden space-y-3">
            {customers.map((c) => (
              <div
                key={c._id}
                onClick={() => navigate(`/customers/${c._id}`)}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs active:bg-slate-50 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs">
                      {getInitials(c.name)}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                      <p className="text-slate-500 text-xs">{c.company || 'Individual'}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase ${getProbabilityBadgeClass(
                      c.reorderProbability
                    )}`}
                  >
                    {c.reorderProbability}% Reorder
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone:</span>
                    <span className="font-semibold text-slate-800">{c.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Executive:</span>
                    <span className="font-semibold text-slate-800">{c.salesExecutive?.name || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Next Reorder:</span>
                    <span className="font-semibold text-slate-800">
                      {c.expectedReorderDate
                        ? new Date(c.expectedReorderDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {canDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomer(c._id, c.name);
                      }}
                      className="text-xs text-rose-600 font-semibold flex items-center gap-1"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  )}
                  <button className="text-xs font-bold text-red-600 flex items-center gap-1 ml-auto">
                    <span>View 360° Customer Profile</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
