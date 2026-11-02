import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Users, Search, Trash2, ArrowRight, Phone, Mail, Building, Plus, X, ShoppingBag, Eye, FileSpreadsheet, Download, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { SkeletonCustomerDirectory } from '../components/ui/Skeleton';
import NewOrderModal from '../components/NewOrderModal';
import Button from '../components/ui/Button';
import LoadingButton from '../components/ui/LoadingButton';
import AccordionCard from '../components/ui/AccordionCard';
import { exportCustomerToExcel, exportAllCustomersToExcel } from '../utils/exportUtils';
import {
  getLiveReorderProbability,
  getProbabilityColorClass,
  getProbabilityBadgeClass,
  getOrderButtonClass
} from '../utils/reorderHelper';

export default function Customers() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exportingCustomerId, setExportingCustomerId] = useState(null);

  // Bulk Export & Import State
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Order Modal State for direct popup from Customers page
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderCustomer, setSelectedOrderCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    phone2: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    billingAttention: '',
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

    let cleanPhone = undefined;
    if (formData.phone) {
      const digitsOnly = formData.phone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        notify.error('Please enter a valid phone number (7 to 15 digits)');
        return;
      }
      cleanPhone = formData.phone.trim();
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
        phone: cleanPhone || formData.phone,
        phone2: formData.phone2 ? formData.phone2.trim() : '',
        email: formData.email ? formData.email.trim().toLowerCase() : undefined,
        billingAttention: formData.billingAttention ? formData.billingAttention.trim() : '',
        address: formData.address ? formData.address.trim() : '',
        city: formData.city ? formData.city.trim() : '',
        state: formData.state ? formData.state.trim() : '',
        pincode: formData.pincode ? formData.pincode.trim() : ''
      };
      const res = await api.post('/customers', payload);
      notify.success('New customer account created successfully!');
      setShowAddModal(false);
      setFormData({
        name: '',
        company: '',
        phone: '',
        phone2: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        billingAttention: '',
        gstNo: '',
        customerType: 'Distributor'
      });
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

  const handleExportAllCustomers = async () => {
    if (isExportingAll) return;
    try {
      setIsExportingAll(true);
      await exportAllCustomersToExcel({ search, notify });
    } catch (err) {
      // notification handled inside exportAllCustomersToExcel
    } finally {
      setIsExportingAll(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e?.preventDefault();
    if (!importFile) {
      notify.error('Please select an Excel file (.xlsx or .xls) to import');
      return;
    }

    try {
      setIsImporting(true);
      setImportResult(null);

      const form = new FormData();
      form.append('file', importFile);

      const res = await api.post('/customers/import-excel', form, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(res.data);
      notify.success(res.data?.message || 'Customers imported successfully!');
      fetchCustomers();
    } catch (err) {
      console.error('Customer import failed:', err);
      const msg = err.response?.data?.message || 'Failed to import customers from Excel file';
      notify.error(msg);
    } finally {
      setIsImporting(false);
    }
  };



  const handleExportCustomerExcel = async (e, cust) => {
    e.stopPropagation();
    if (!cust?._id || exportingCustomerId) return;
    try {
      setExportingCustomerId(cust._id);
      await exportCustomerToExcel(cust._id, cust.name || 'Customer', notify);
    } catch (err) {
      // Error notifications handled by exportCustomerToExcel
    } finally {
      setExportingCustomerId(null);
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
    const safeScore = score ?? 0;
    if (safeScore >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (safeScore >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, city, phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <Search size={16} className="text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            onClick={handleExportAllCustomers}
            disabled={isExportingAll || safeCustomers.length === 0}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            title="Export full customer directory to Excel"
          >
            {isExportingAll ? (
              <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={15} className="text-slate-500" />
            )}
            <span>Export Customers</span>
          </button>

          {(role === 'super_admin' || role === 'manager') && (
            <button
              onClick={() => {
                setImportFile(null);
                setImportResult(null);
                setShowImportModal(true);
              }}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Import customers from Excel spreadsheet"
            >
              <UploadCloud size={15} className="text-slate-500" />
              <span>Import Customers</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedOrderCustomer(null);
              setShowNewOrderModal(true);
            }}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <ShoppingBag size={16} />
            <span>+ New Order</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                name: '',
                company: '',
                phone: '',
                phone2: '',
                email: '',
                address: '',
                city: '',
                state: '',
                pincode: '',
                billingAttention: '',
                gstNo: '',
                customerType: 'Distributor'
              });
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
        <SkeletonCustomerDirectory rows={6} />
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
                      <p className="font-semibold text-slate-800">{c.phone || '—'}</p>
                      {c.phone2 && (
                        <p className="text-slate-500 text-[11px] font-normal truncate max-w-[240px]" title={c.phone2}>
                          <span className="font-medium text-slate-600">Alt:</span> {c.phone2}
                        </p>
                      )}
                      <p className="text-slate-500 text-[11px] font-normal truncate max-w-[240px]">
                        {[c.city, c.state].filter(Boolean).join(', ') || c.address || '—'}
                      </p>
                      {c.email && (
                        <p className="text-slate-400 text-[11px] font-normal truncate max-w-[240px]">{c.email}</p>
                      )}
                      {c.billingAttention && (
                        <p className="text-[10px] text-slate-400 font-medium truncate max-w-[240px]">
                          Attn: {c.billingAttention}
                        </p>
                      )}
                    </td>

                    <td className="p-4 font-medium text-slate-700">
                      {c.salesExecutive?.name || 'Unassigned'}
                    </td>

                    <td className="p-4">
                      {(() => {
                        const prob = getLiveReorderProbability(c);
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getProbabilityColorClass(prob)}`}
                                style={{ width: `${Math.min(100, Math.max(0, prob))}%` }}
                              ></div>
                            </div>
                            <span
                              className={`px-2 py-0.5 border text-[10px] font-medium rounded-md uppercase ${getProbabilityBadgeClass(
                                prob
                              )}`}
                            >
                              {prob}%
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    <td className="p-4 font-medium text-slate-800">
                      {c.expectedReorderDate
                        ? new Date(c.expectedReorderDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })
                        : 'N/A'}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title={`Export Excel Report for ${c.name}`}
                          disabled={exportingCustomerId === c._id}
                          onClick={(e) => handleExportCustomerExcel(e, c)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer disabled:opacity-50"
                        >
                          {exportingCustomerId === c._id ? (
                            <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <FileSpreadsheet size={15} />
                          )}
                        </button>
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
                          type="button"
                          title={`View ${c.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customers/${c._id}`);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Accordion Card View */}
          <div className="md:hidden space-y-3">
            {safeCustomers.map((c) => {
              const prob = getLiveReorderProbability(c);
              const initials = getInitials(c.name);

              return (
                <AccordionCard
                  key={c._id}
                  title={
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shadow-2xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">{c.name}</h4>
                        <p className="text-slate-500 text-xs font-normal truncate">{c.company || 'Individual Account'}</p>
                      </div>
                    </div>
                  }
                  headerExtra={
                    <span className={`px-2 py-0.5 border text-[10px] font-semibold rounded-md uppercase shrink-0 ${getProbabilityBadgeClass(prob)}`}>
                      {prob}% Reorder
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 font-medium text-[11px] block">Primary Contact</span>
                      <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-800 hover:text-blue-600 truncate block">
                        {c.phone || 'N/A'}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium text-[11px] block">Secondary Phone</span>
                      {c.phone2 ? (
                        <a href={`tel:${c.phone2.split(',')[0].trim()}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-800 hover:text-blue-600 truncate block" title={c.phone2}>
                          {c.phone2}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-400">—</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium text-[11px] block">Expected Reorder</span>
                      <span className="font-semibold text-slate-800">
                        {c.expectedReorderDate ? new Date(c.expectedReorderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium text-[11px] block">Sales Executive</span>
                      <span className="font-medium text-slate-700">{c.salesExecutive?.name || c.assignedTo?.name || 'Unassigned'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 font-medium text-[11px] block">Billing Location</span>
                      <span className="font-medium text-slate-700 truncate block">
                        {[c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ') || 'N/A'}
                      </span>
                    </div>
                    {c.billingAttention && (
                      <div className="col-span-2">
                        <span className="text-slate-400 font-medium text-[11px] block">Billing Attention</span>
                        <span className="font-medium text-slate-700 truncate block">{c.billingAttention}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="col-span-2">
                        <span className="text-slate-400 font-medium text-[11px] block">Email</span>
                        <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="font-medium text-blue-600 truncate block">
                          {c.email}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      icon={FileSpreadsheet}
                      loading={exportingCustomerId === c._id}
                      loadingText="Exporting..."
                      onClick={(e) => handleExportCustomerExcel(e, c)}
                      className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 shrink-0"
                    >
                      Excel
                    </Button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/customers/${c._id}`);
                      }}
                      className="flex-1 py-2 px-3 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Eye size={14} />
                      <span>View Details</span>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomer(c._id, c.name);
                        }}
                        className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                        title={`Delete ${c.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </AccordionCard>
              );
            })}
          </div>
        </>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Acme Industries"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. Acme Corp Ltd"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Primary Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone 2 / Secondary Contact</label>
                  <input
                    type="text"
                    value={formData.phone2}
                    onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                    placeholder="e.g. 9176989333, 044-245678"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email ID</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Attention</label>
                  <input
                    type="text"
                    value={formData.billingAttention}
                    onChange={(e) => setFormData({ ...formData, billingAttention: e.target.value })}
                    placeholder="e.g. Accounts Department / Mr. Sharma"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Billing Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street / Plot / Industrial Estate"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
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
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="Tamil Nadu"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    placeholder="600001"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  loadingText="Creating..."
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-2xs cursor-pointer"
                >
                  Create Customer
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Customers Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <UploadCloud size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Import Customers from Excel</h3>
                  <p className="text-[11px] text-slate-500">Supports Invoice Billing Details spreadsheet (.xlsx / .xls)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isImporting) {
                    setShowImportModal(false);
                    setImportFile(null);
                    setImportResult(null);
                  }
                }}
                disabled={isImporting}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {importResult ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>{importResult.message || 'Import completed successfully!'}</span>
                  </div>
                  {importResult.summary && (
                    <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] font-medium border-t border-emerald-200">
                      <div>Parsed: <span className="font-bold text-slate-800">{importResult.summary.totalParsed}</span></div>
                      <div>Created: <span className="font-bold text-emerald-700">{importResult.summary.createdCount}</span></div>
                      <div>Updated: <span className="font-bold text-blue-700">{importResult.summary.updatedCount}</span></div>
                    </div>
                  )}
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] space-y-1 max-h-36 overflow-y-auto">
                    <div className="flex items-center gap-1 font-semibold text-amber-900">
                      <AlertCircle size={14} />
                      <span>{importResult.errors.length} Warnings/Skipped Rows:</span>
                    </div>
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="pl-2 border-l-2 border-amber-300">{err}</div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition text-center space-y-2">
                  <input
                    type="file"
                    id="customer-excel-file-input"
                    accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImportFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="customer-excel-file-input"
                    className="cursor-pointer block space-y-2"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800 hover:text-emerald-700">
                        {importFile ? importFile.name : 'Click to select Excel file'}
                      </span>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Supports customer billing details (.xlsx or .xls)
                      </p>
                    </div>
                  </label>
                  {importFile && (
                    <div className="text-[11px] text-emerald-700 font-medium">
                      Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Automatic Ingestion Features:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Customer name and company mapping</li>
                    <li>Primary mobile number used as main contact phone</li>
                    <li>Additional phone numbers mapped to Phone 2</li>
                    <li>Billing address, city, state, and postal code populated</li>
                  </ul>
                </div>

                <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <LoadingButton
                    type="submit"
                    disabled={!importFile}
                    loading={isImporting}
                    loadingText="Importing..."
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    Upload & Import
                  </LoadingButton>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* New Order Popup Modal */}
      {showNewOrderModal && (
        <NewOrderModal
          isOpen={showNewOrderModal}
          onClose={() => setShowNewOrderModal(false)}
          onSuccess={() => {
            notify.success('New order created successfully');
            fetchCustomers();
          }}
          initialCustomer={selectedOrderCustomer}
        />
      )}
    </div>
  );
}
