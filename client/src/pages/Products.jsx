import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Ruler,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Filter,
  Layers,
  Calendar,
  IndianRupee,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';
import LoadingButton from '../components/ui/LoadingButton';

const CATEGORY_OPTIONS = [
  'BOPP',
  'Barcode',
  'Thermal Paper',
  'Transparent',
  'Chromo Paper',
  'Security Film',
  'Matte Paper',
  'Glossy Paper',
  'Polyester Film'
];

export default function Products() {
  const { role, permissions } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  // Role permissions check
  const canManage = role === 'super_admin' || permissions?.products?.includes('create');
  const canEdit = role === 'super_admin' || permissions?.products?.includes('edit');
  const canDelete = role === 'super_admin' || permissions?.products?.includes('delete');

  // Products state
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Filters state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');

  // Add / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    widthMm: '',
    heightMm: '',
    category: '',
    customCategory: '',
    defaultUsageCycleDays: 30,
    unitPrice: '',
    status: 'active'
  });

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit
      };

      if (search && search.trim()) params.search = search.trim();
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/products', { params });

      if (res.data) {
        if (Array.isArray(res.data)) {
          setProducts(res.data);
          setTotalCount(res.data.length);
          setTotalPages(1);
        } else if (Array.isArray(res.data.products)) {
          setProducts(res.data.products);
          setTotalCount(res.data.total || res.data.products.length);
          setTotalPages(res.data.pages || 1);
        } else {
          setProducts([]);
          setTotalCount(0);
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      notify.error(err.response?.data?.message || 'Failed to fetch products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search / filter trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, statusFilter, page]);

  // Reset page to 1 when filters change
  const handleFilterChange = (setter, val) => {
    setter(val);
    setPage(1);
  };

  // Client-side cycle filter if needed (or backend query)
  const displayedProducts = useMemo(() => {
    if (!cycleFilter) return products;
    return products.filter(p => p.defaultUsageCycleDays === Number(cycleFilter));
  }, [products, cycleFilter]);

  // Modal open handlers
  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      widthMm: '',
      heightMm: '',
      category: '',
      customCategory: '',
      defaultUsageCycleDays: 30,
      unitPrice: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setIsEditing(true);
    setEditingId(product._id);

    const isCustomCat = product.category && !CATEGORY_OPTIONS.includes(product.category);

    setFormData({
      name: product.name || '',
      widthMm: product.widthMm != null ? String(product.widthMm) : '',
      heightMm: product.heightMm != null ? String(product.heightMm) : '',
      category: isCustomCat ? 'Custom' : (product.category || ''),
      customCategory: isCustomCat ? product.category : '',
      defaultUsageCycleDays: product.defaultUsageCycleDays || 30,
      unitPrice: product.unitPrice != null ? String(product.unitPrice) : '',
      status: product.status || 'active'
    });
    setShowModal(true);
  };

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      notify.error('Product name is required');
      return;
    }

    const width = parseFloat(formData.widthMm);
    if (isNaN(width) || width <= 0) {
      notify.error('Please enter a valid width in mm');
      return;
    }

    const height = parseFloat(formData.heightMm);
    if (isNaN(height) || height <= 0) {
      notify.error('Please enter a valid height in mm');
      return;
    }

    let finalCategory = formData.category;
    if (formData.category === 'Custom') {
      finalCategory = formData.customCategory.trim();
    }

    let finalPrice = null;
    if (formData.unitPrice !== '' && formData.unitPrice !== null && formData.unitPrice !== undefined) {
      const p = parseFloat(formData.unitPrice);
      if (!isNaN(p) && p >= 0) {
        finalPrice = p;
      }
    }

    const payload = {
      name: formData.name.trim(),
      widthMm: width,
      heightMm: height,
      category: finalCategory || undefined,
      defaultUsageCycleDays: Number(formData.defaultUsageCycleDays) || 30,
      unitPrice: finalPrice,
      status: formData.status
    };

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await api.patch(`/products/${editingId}`, payload);
        notify.success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        notify.success('Product added successfully');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      notify.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete product handler
  const handleDelete = async (product) => {
    const isConfirmed = await confirm({
      title: 'Move Product to Trash',
      message: `Are you sure you want to delete "${product.name}" (${product.dimensionKey || `${product.widthMm}x${product.heightMm}`})? It will be soft-deleted to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/products/${product._id}`);
      notify.success(`Product "${product.name}" moved to Trash`);
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      notify.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  // Quick stats calculation
  const stats = useMemo(() => {
    const activeCount = products.filter(p => p.status === 'active').length;
    const cycle30Count = products.filter(p => p.defaultUsageCycleDays === 30).length;
    const cycle45Count = products.filter(p => p.defaultUsageCycleDays === 45).length;
    const uniqueDims = new Set(products.map(p => p.dimensionKey || `${p.widthMm}x${p.heightMm}`)).size;
    return { activeCount, cycle30Count, cycle45Count, uniqueDims };
  }, [products]);

  // Preview dimension computed live
  const previewDimKey = useMemo(() => {
    const w = formData.widthMm ? formData.widthMm.trim() : '';
    const h = formData.heightMm ? formData.heightMm.trim() : '';
    if (w && h) {
      return `${w}x${h}`;
    }
    return '';
  }, [formData.widthMm, formData.heightMm]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Ruler size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Products Catalog</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Dimension-based label catalog with auto-computed dimension keys and usage cycles</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm shadow-red-600/20 transition cursor-pointer"
            >
              <Plus size={16} className="stroke-[2.5]" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Listed</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <Layers size={18} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Status</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">{stats.activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">30-Day Cycles</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600 mt-0.5">{stats.cycle30Count}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">45-Day Cycles</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-0.5">{stats.cycle45Count}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <Calendar size={18} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              placeholder="Search by product name, dimension (e.g. 4x45, 10x15), or category..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
            {search && (
              <button
                onClick={() => handleFilterChange(setSearch, '')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => handleFilterChange(setCategoryFilter, e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
            >
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Cycle Filter */}
            <select
              value={cycleFilter}
              onChange={(e) => handleFilterChange(setCycleFilter, e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
            >
              <option value="">All Cycles</option>
              <option value="30">30 Days Cycle</option>
              <option value="45">45 Days Cycle</option>
            </select>

            {(search || categoryFilter || statusFilter || cycleFilter) && (
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setStatusFilter('');
                  setCycleFilter('');
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition cursor-pointer flex items-center gap-1"
              >
                <X size={14} /> Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : displayedProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Ruler size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">No Products Found</h3>
            <p className="text-xs text-slate-500 font-normal">
              {search || categoryFilter || statusFilter || cycleFilter
                ? 'Try adjusting your search criteria or clearing active filters.'
                : 'No label products have been added yet.'}
            </p>
          </div>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus size={15} /> Add First Product
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">Dimension (W × H)</th>
                    <th className="py-3.5 px-5">Product Name</th>
                    <th className="py-3.5 px-5">Category</th>
                    <th className="py-3.5 px-5">Usage Cycle</th>
                    <th className="py-3.5 px-5">Unit Price</th>
                    <th className="py-3.5 px-5">Status</th>
                    {canManage && <th className="py-3.5 px-5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {displayedProducts.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition">
                      {/* Dimension: Main prominent identifier */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg shadow-2xs border border-slate-800">
                            <Ruler size={13} className="text-red-400 stroke-[2.5]" />
                            {p.widthMm} × {p.heightMm} mm
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 font-medium">
                            ({p.dimensionKey || `${p.widthMm}x${p.heightMm}`})
                          </span>
                        </div>
                      </td>

                      {/* Friendly Name */}
                      <td className="py-4 px-5">
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {p.name}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-4 px-5">
                        {p.category ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                            {p.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">General</span>
                        )}
                      </td>

                      {/* Default Usage Cycle */}
                      <td className="py-4 px-5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            p.defaultUsageCycleDays === 45
                              ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                          }`}
                        >
                          <Clock size={13} />
                          {p.defaultUsageCycleDays || 30} Days
                        </span>
                      </td>

                      {/* Unit Price */}
                      <td className="py-4 px-5">
                        {p.unitPrice != null && p.unitPrice !== '' ? (
                          <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                            ₹{Number(p.unitPrice).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic font-normal">
                            Not set
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {p.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions for Super Admin */}
                      {canManage && (
                        <td className="py-4 px-5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canEdit && (
                              <button
                                onClick={() => handleOpenEdit(p)}
                                title="Edit Product"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              >
                                <Edit2 size={15} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(p)}
                                title="Delete Product"
                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3">
            {displayedProducts.map((p) => (
              <div
                key={p._id}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3"
              >
                {/* Card Header: Dimension & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg shadow-2xs">
                      <Ruler size={13} className="text-red-400 stroke-[2.5]" />
                      {p.widthMm} × {p.heightMm} mm
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      ({p.dimensionKey || `${p.widthMm}x${p.heightMm}`})
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      p.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {p.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Product Name & Category */}
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Category: <span className="font-medium text-slate-700">{p.category || 'General'}</span>
                  </p>
                </div>

                {/* Details Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Usage Cycle</span>
                    <p className="font-semibold text-slate-800">{p.defaultUsageCycleDays || 30} Days</p>
                  </div>

                  <div className="space-y-0.5 text-right">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Unit Price</span>
                    <p className="font-semibold text-slate-900">
                      {p.unitPrice != null && p.unitPrice !== '' ? `₹${Number(p.unitPrice).toFixed(2)}` : 'Not set'}
                    </p>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 pl-2">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-200 font-medium transition cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-slate-200 font-medium transition cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <Ruler size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isEditing ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isEditing ? 'Update label dimensions, details or pricing' : 'Create a dimension-based label specification'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4.5">
              {/* Product Friendly Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Product Friendly Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder='e.g. "4x45 Standard Label" or "10x15 Barcode Label"'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                />
              </div>

              {/* Dimensions Input (Width & Height mm) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Width (mm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    placeholder="e.g. 4"
                    value={formData.widthMm}
                    onChange={(e) => setFormData({ ...formData, widthMm: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Height (mm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    placeholder="e.g. 45"
                    value={formData.heightMm}
                    onChange={(e) => setFormData({ ...formData, heightMm: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition font-mono"
                  />
                </div>
              </div>

              {/* Live Dimension Key Preview */}
              {previewDimKey && (
                <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between border border-slate-800">
                  <div className="flex items-center gap-2">
                    <Ruler size={16} className="text-red-400 stroke-[2.5]" />
                    <span className="text-xs text-slate-300">Generated Dimension Key:</span>
                  </div>
                  <span className="font-mono font-bold text-xs sm:text-sm text-red-400 bg-slate-800 px-2.5 py-0.5 rounded-lg">
                    {previewDimKey}
                  </span>
                </div>
              )}

              {/* Category Dropdown / Free text */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Category <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
                  >
                    <option value="">Select Category...</option>
                    {CATEGORY_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Custom">Custom / Other...</option>
                  </select>

                  {formData.category === 'Custom' && (
                    <input
                      type="text"
                      placeholder="Enter custom category"
                      value={formData.customCategory}
                      onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 transition"
                    />
                  )}
                </div>
              </div>

              {/* Usage Cycle Dropdown & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Default Usage Cycle
                  </label>
                  <select
                    value={formData.defaultUsageCycleDays}
                    onChange={(e) => setFormData({ ...formData, defaultUsageCycleDays: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
                  >
                    <option value={30}>30 Days (Standard)</option>
                    <option value={45}>45 Days (Extended)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Unit Price (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Unit Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-medium text-xs">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 1.25"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Optional — leave blank if not tracking pricing
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-red-600/20 transition cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Create Product'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
