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
  Layers,
  Calendar,
  CheckCircle2,
  Clock,
  Briefcase,
  Palette,
  Tag,
  Box,
  Timer,
  FileSpreadsheet
} from 'lucide-react';
import { SkeletonTable } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import SelectOrCreate from '../components/ui/SelectOrCreate';
import ProductDetailsModal from '../components/ProductDetailsModal';
import { exportProductToExcel } from '../utils/exportUtils';

const PRESET_CATEGORIES = [
  'BOPP',
  'Barcode',
  'Thermal Paper',
  'Transparent',
  'Chromo Paper',
  'Security Film',
  'Matte Paper',
  'Glossy Paper',
  'Polyester Film',
  'Pharma',
  'FMCG',
  'Cosmetics',
  'Logistics',
  'Food & Beverage',
  'Industrial',
  'General'
];

const PRESET_JOB_NAMES = [
  'Standard Barcode',
  'Direct Thermal Shipping',
  'Glossy Product Label',
  'Pharma Vial Label',
  'Food Grade Packaging',
  'Asset Tracking Tag',
  'Jewellery Tag',
  'Garment Tag',
  'Retail Price Tag'
];

const PRESET_MATERIALS = [
  'Chromo Paper',
  'Direct Thermal (DT)',
  'Thermal Transfer (TT)',
  'Polypropylene (PP)',
  'Polyester (PET)',
  'Vinyl',
  'Foil Paper',
  'Clear Transparent',
  'Silver Metallic'
];

const PRESET_COLOURS = [
  'White',
  'Natural / Clear',
  'Yellow',
  'Red',
  'Blue',
  'Green',
  'Silver',
  'Gold',
  'Multi-color',
  'Fluorescent Orange',
  'Black'
];

const PRESET_USAGE_CYCLES = [
  { value: 15, label: '15 Days (Rapid)' },
  { value: 30, label: '30 Days (Standard)' },
  { value: 45, label: '45 Days (Extended)' },
  { value: 60, label: '60 Days (Bi-monthly)' },
  { value: 90, label: '90 Days (Quarterly)' }
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

  // Custom added options state (in-session persistence so newly created items persist in dropdowns)
  const [customJobNames, setCustomJobNames] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [customMaterials, setCustomMaterials] = useState([]);
  const [customColours, setCustomColours] = useState([]);
  const [customUsageCycles, setCustomUsageCycles] = useState([]);

  // Soft-deleted custom options tracking (persisted in localStorage so deleted custom options stay removed from future product selections)
  const [deletedCustomOptions, setDeletedCustomOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('jslabels_deleted_custom_product_options');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const isOptionDeleted = (val) => {
    if (!val) return true;
    const str = String(val).trim().toLowerCase();
    return deletedCustomOptions.some((d) => String(d).trim().toLowerCase() === str);
  };

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

  // Job Time / Product Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState(null);
  const [exportingProductId, setExportingProductId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    widthMm: '',
    heightMm: '',
    jobName: '',
    category: '',
    material: '',
    colour: '',
    defaultUsageCycleDays: 30,
    status: 'active'
  });

  // Dynamic deduplicated options lists
  const jobNameOptions = useMemo(() => {
    const map = new Map();
    PRESET_JOB_NAMES.forEach((j) => map.set(j.toLowerCase(), j));
    customJobNames.forEach((j) => {
      if (!isOptionDeleted(j)) map.set(j.toLowerCase(), j);
    });
    products.forEach((p) => {
      if (p.jobName && p.jobName.trim() && !isOptionDeleted(p.jobName)) {
        map.set(p.jobName.trim().toLowerCase(), p.jobName.trim());
      }
    });
    return Array.from(map.values());
  }, [products, customJobNames, deletedCustomOptions]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    PRESET_CATEGORIES.forEach((c) => map.set(c.toLowerCase(), c));
    customCategories.forEach((c) => {
      if (!isOptionDeleted(c)) map.set(c.toLowerCase(), c);
    });
    products.forEach((p) => {
      if (p.category && p.category.trim() && !isOptionDeleted(p.category)) {
        map.set(p.category.trim().toLowerCase(), p.category.trim());
      }
    });
    return Array.from(map.values());
  }, [products, customCategories, deletedCustomOptions]);

  const materialOptions = useMemo(() => {
    const map = new Map();
    PRESET_MATERIALS.forEach((m) => map.set(m.toLowerCase(), m));
    customMaterials.forEach((m) => {
      if (!isOptionDeleted(m)) map.set(m.toLowerCase(), m);
    });
    products.forEach((p) => {
      if (p.material && p.material.trim() && !isOptionDeleted(p.material)) {
        map.set(p.material.trim().toLowerCase(), p.material.trim());
      }
    });
    return Array.from(map.values());
  }, [products, customMaterials, deletedCustomOptions]);

  const colourOptions = useMemo(() => {
    const map = new Map();
    PRESET_COLOURS.forEach((c) => map.set(c.toLowerCase(), c));
    customColours.forEach((c) => {
      if (!isOptionDeleted(c)) map.set(c.toLowerCase(), c);
    });
    products.forEach((p) => {
      if (p.colour && p.colour.trim() && !isOptionDeleted(p.colour)) {
        map.set(p.colour.trim().toLowerCase(), p.colour.trim());
      }
    });
    return Array.from(map.values());
  }, [products, customColours, deletedCustomOptions]);

  const usageCycleOptions = useMemo(() => {
    const map = new Map();
    PRESET_USAGE_CYCLES.forEach((u) => map.set(u.value, u));
    customUsageCycles.forEach((u) => {
      const val = typeof u === 'object' ? u.value : Number(u);
      if (!isNaN(val) && val > 0 && !isOptionDeleted(val)) {
        const lbl = typeof u === 'object' ? u.label : `${val} Days`;
        map.set(val, { value: val, label: lbl });
      }
    });
    products.forEach((p) => {
      if (
        p.defaultUsageCycleDays &&
        !map.has(p.defaultUsageCycleDays) &&
        !isOptionDeleted(p.defaultUsageCycleDays)
      ) {
        map.set(p.defaultUsageCycleDays, {
          value: p.defaultUsageCycleDays,
          label: `${p.defaultUsageCycleDays} Days`
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.value - b.value);
  }, [products, customUsageCycles, deletedCustomOptions]);

  // Handle deleting a custom option with confirmation dialog
  const handleDeleteOption = async (fieldKey, optionValue) => {
    const isConfirmed = await confirm({
      title: 'Delete this option?',
      message: 'This will remove the option from future product selections. Existing products using this value will not be modified.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    setDeletedCustomOptions((prev) => {
      const updated = Array.from(new Set([...prev, String(optionValue)]));
      try {
        localStorage.setItem('jslabels_deleted_custom_product_options', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving deleted option to storage:', e);
      }
      return updated;
    });

    if (fieldKey === 'jobName') {
      setCustomJobNames((prev) => prev.filter((j) => String(j).toLowerCase() !== String(optionValue).toLowerCase()));
    } else if (fieldKey === 'category') {
      setCustomCategories((prev) => prev.filter((c) => String(c).toLowerCase() !== String(optionValue).toLowerCase()));
    } else if (fieldKey === 'material') {
      setCustomMaterials((prev) => prev.filter((m) => String(m).toLowerCase() !== String(optionValue).toLowerCase()));
    } else if (fieldKey === 'colour') {
      setCustomColours((prev) => prev.filter((c) => String(c).toLowerCase() !== String(optionValue).toLowerCase()));
    } else if (fieldKey === 'usageCycle') {
      setCustomUsageCycles((prev) =>
        prev.filter((u) => {
          const val = typeof u === 'object' ? u.value : u;
          return String(val) !== String(optionValue);
        })
      );
    }

    notify.success(`Option "${optionValue}" removed from future selections`);
  };

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
    return products.filter((p) => p.defaultUsageCycleDays === Number(cycleFilter));
  }, [products, cycleFilter]);

  // Modal open handlers
  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      name: '',
      widthMm: '',
      heightMm: '',
      jobName: '',
      category: '',
      material: '',
      colour: '',
      defaultUsageCycleDays: 30,
      status: 'active'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setIsEditing(true);
    setEditingId(product._id);

    setFormData({
      name: product.name || '',
      widthMm: product.widthMm != null ? String(product.widthMm) : '',
      heightMm: product.heightMm != null ? String(product.heightMm) : '',
      jobName: product.jobName || '',
      category: product.category || '',
      material: product.material || '',
      colour: product.colour || '',
      defaultUsageCycleDays: product.defaultUsageCycleDays || 30,
      status: product.status || 'active'
    });
    setShowModal(true);
  };

  // Open Product Details & Job Time Management Modal
  const handleOpenDetails = (product) => {
    setSelectedProductForDetails(product);
    setShowDetailsModal(true);
  };

  // Handle live update of product after job times modification
  const handleProductUpdated = (updatedProduct) => {
    if (!updatedProduct || !updatedProduct._id) return;
    setProducts((prev) =>
      prev.map((p) => (p._id === updatedProduct._id ? { ...p, ...updatedProduct } : p))
    );
    if (selectedProductForDetails?._id === updatedProduct._id) {
      setSelectedProductForDetails(updatedProduct);
    }
  };

  // Handle Export Single Product Details to Excel
  const handleExportProduct = async (product) => {
    if (!product || !product._id) return;
    if (exportingProductId === product._id) return;

    try {
      setExportingProductId(product._id);
      await exportProductToExcel(product._id, product.name || 'Product', notify);
    } catch (err) {
      // notification handled inside exportProductToExcel
    } finally {
      setExportingProductId(null);
    }
  };

  // Handle custom cycle creation helper
  const handleCustomUsageCycleCreate = (rawInput) => {
    const parsedNumber = parseInt(String(rawInput).replace(/\D/g, ''), 10);
    if (!isNaN(parsedNumber) && parsedNumber > 0) {
      const newOption = {
        value: parsedNumber,
        label: `${parsedNumber} Days`
      };
      setCustomUsageCycles((prev) => [...prev, newOption]);
      setFormData((prev) => ({ ...prev, defaultUsageCycleDays: parsedNumber }));
    } else {
      notify.error('Please enter a valid numeric number of days');
    }
  };

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      notify.error('Product Friendly Name is required');
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

    if (!formData.jobName || !formData.jobName.trim()) {
      notify.error('Job Name is required');
      return;
    }

    if (!formData.material || !formData.material.trim()) {
      notify.error('Material is required');
      return;
    }

    if (!formData.colour || !formData.colour.trim()) {
      notify.error('Colour is required');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      widthMm: width,
      heightMm: height,
      jobName: formData.jobName.trim(),
      category: formData.category ? formData.category.trim() : undefined,
      material: formData.material.trim(),
      colour: formData.colour.trim(),
      defaultUsageCycleDays: Number(formData.defaultUsageCycleDays) || 30,
      status: formData.status || 'active'
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

      // Add custom values into session lists if they don't already exist
      if (payload.jobName && !customJobNames.includes(payload.jobName)) {
        setCustomJobNames((prev) => [...prev, payload.jobName]);
      }
      if (payload.category && !customCategories.includes(payload.category)) {
        setCustomCategories((prev) => [...prev, payload.category]);
      }
      if (payload.material && !customMaterials.includes(payload.material)) {
        setCustomMaterials((prev) => [...prev, payload.material]);
      }
      if (payload.colour && !customColours.includes(payload.colour)) {
        setCustomColours((prev) => [...prev, payload.colour]);
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
      message: `Are you sure you want to delete "${product.name}" (${
        product.dimensionKey || `${product.widthMm}x${product.heightMm}`
      })? It will be soft-deleted to System Trash.`,
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
    const activeCount = products.filter((p) => p.status === 'active').length;
    const cycle30Count = products.filter((p) => p.defaultUsageCycleDays === 30).length;
    const cycle45Count = products.filter((p) => p.defaultUsageCycleDays === 45).length;
    const uniqueDims = new Set(
      products.map((p) => p.dimensionKey || `${p.widthMm}x${p.heightMm}`)
    ).size;
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
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Products Catalog
              </h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                Dimension-based label catalog with auto-computed dimension keys, job specifications, and usage cycles
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <Button
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenAdd}
            >
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Listed
            </p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
            <Layers size={18} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active Status
            </p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-0.5">
              {stats.activeCount}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              30-Day Cycles
            </p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-600 mt-0.5">
              {stats.cycle30Count}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              45-Day Cycles
            </p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-0.5">
              {stats.cycle45Count}
            </p>
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
              placeholder="Search by product name, job, dimension (e.g. 4x45), material, or colour..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
            />
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleFilterChange(setSearch, '')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </Button>
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
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
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
              <option value="15">15 Days Cycle</option>
              <option value="30">30 Days Cycle</option>
              <option value="45">45 Days Cycle</option>
              <option value="60">60 Days Cycle</option>
              <option value="90">90 Days Cycle</option>
            </select>

            {(search || categoryFilter || statusFilter || cycleFilter) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={X}
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setStatusFilter('');
                  setCycleFilter('');
                  setPage(1);
                }}
                className="text-red-600 hover:bg-red-50 border-red-200"
              >
                Clear Filters
              </Button>
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
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenAdd}
            >
              Add First Product
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                    <th className="py-3.5 px-4.5">Dimension</th>
                    <th className="py-3.5 px-4.5">Product Name</th>
                    <th className="py-3.5 px-4">Job Name</th>
                    <th className="py-3.5 px-4">Material & Colour</th>
                    <th className="py-3.5 px-4">Job Time</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Usage Cycle</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {displayedProducts.map((p) => {
                    const latestJobTime = p.jobTimes && p.jobTimes.length > 0
                      ? [...p.jobTimes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                      : null;

                    return (
                      <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Dimension Badge */}
                        <td className="py-3.5 px-4.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(p)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg shadow-2xs border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                            title="Click to view specifications & job time history"
                          >
                            <Ruler size={13} className="text-red-400 stroke-[2.5]" />
                            <span>{p.widthMm} × {p.heightMm} mm</span>
                          </button>
                        </td>

                        {/* Product Friendly Name */}
                        <td className="py-3.5 px-4.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(p)}
                            className="font-semibold text-slate-900 text-xs sm:text-sm hover:text-red-600 transition text-left cursor-pointer truncate max-w-[220px] block"
                            title={p.name}
                          >
                            {p.name}
                          </button>
                        </td>

                        {/* Job Name */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {p.jobName ? (
                            <div className="flex items-center gap-1.5 text-slate-800 font-medium max-w-[160px] truncate" title={p.jobName}>
                              <Briefcase size={13} className="text-slate-400 shrink-0" />
                              <span className="truncate">{p.jobName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Material & Colour */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            {p.material && (
                              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Box size={12} className="text-slate-400 shrink-0" />
                                <span>{p.material}</span>
                              </div>
                            )}
                            {p.colour && (
                              <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                                <Palette size={12} className="text-red-400 shrink-0" />
                                <span>{p.colour}</span>
                              </div>
                            )}
                            {!p.material && !p.colour && (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </div>
                        </td>

                        {/* Job Time (Latest recorded completion time) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {latestJobTime ? (
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(p)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80 transition cursor-pointer font-mono group"
                              title={`Latest: ${latestJobTime.timeSpent} on ${latestJobTime.date}. Click to view all ${p.jobTimes.length} entries.`}
                            >
                              <Clock size={12} className="text-red-500 stroke-[2.2] group-hover:scale-110 transition-transform" />
                              <span>{latestJobTime.timeSpent}</span>
                              <span className="text-[10px] text-red-500/80 font-sans font-semibold">
                                ({p.jobTimes.length})
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(p)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                              title="Log job time entry"
                            >
                              <Plus size={11} />
                              <span>Log Time</span>
                            </button>
                          )}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {p.category ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/70">
                              {p.category}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* Default Usage Cycle */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                              p.defaultUsageCycleDays === 45
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                : p.defaultUsageCycleDays === 15
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                            }`}
                          >
                            <Clock size={12} className="shrink-0" />
                            <span>{p.defaultUsageCycleDays || 30} Days</span>
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
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
                            <span>{p.status === 'active' ? 'Active' : 'Inactive'}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Export Product Details to Excel (.xlsx)"
                              loading={exportingProductId === p._id}
                              disabled={exportingProductId !== null}
                              onClick={() => handleExportProduct(p)}
                              className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                            >
                              <FileSpreadsheet size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Job Time Management"
                              onClick={() => handleOpenDetails(p)}
                              className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Timer size={15} />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit Product"
                                onClick={() => handleOpenEdit(p)}
                                className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              >
                                <Edit2 size={15} />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete Product"
                                onClick={() => handleDelete(p)}
                                className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={15} />
                              </Button>
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

          {/* Mobile Card List View */}
          <div className="md:hidden space-y-3">
            {displayedProducts.map((p) => {
              const latestJobTime = p.jobTimes && p.jobTimes.length > 0
                ? [...p.jobTimes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                : null;

              return (
                <div
                  key={p._id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3"
                >
                  {/* Card Header: Dimension & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg shadow-2xs"
                      >
                        <Ruler size={13} className="text-red-400 stroke-[2.5]" />
                        {p.widthMm} × {p.heightMm} mm
                      </button>
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

                  {/* Product Name & Job Name */}
                  <div className="space-y-1">
                    <h3
                      onClick={() => handleOpenDetails(p)}
                      className="font-semibold text-slate-900 text-sm hover:text-red-600 transition cursor-pointer"
                    >
                      {p.name}
                    </h3>
                    {p.jobName && (
                      <p className="text-xs text-slate-600 flex items-center gap-1">
                        <Briefcase size={12} className="text-slate-400" />
                        <span>{p.jobName}</span>
                      </p>
                    )}
                  </div>

                  {/* Badges: Material, Colour, Category */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.material && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                        <Box size={11} className="text-slate-400" />
                        {p.material}
                      </span>
                    )}
                    {p.colour && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-red-50 text-red-700">
                        <Palette size={11} className="text-red-500" />
                        {p.colour}
                      </span>
                    )}
                    {p.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                        {p.category}
                      </span>
                    )}
                  </div>

                  {/* Latest Job Time Row on Mobile */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                      <Timer size={11} /> Latest Job Time
                    </span>
                    {latestJobTime ? (
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200/80 font-mono"
                      >
                        <Clock size={11} className="text-red-500" />
                        <span>{latestJobTime.timeSpent}</span>
                        <span className="text-[10px] text-slate-400 font-sans font-normal">
                          ({p.jobTimes.length})
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(p)}
                        className="text-[11px] text-red-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus size={11} /> Log Time
                      </button>
                    )}
                  </div>

                  {/* Details Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        Usage Cycle
                      </span>
                      <p className="font-semibold text-slate-800">
                        {p.defaultUsageCycleDays || 30} Days
                      </p>
                    </div>

                    <div className="flex items-center gap-1 pl-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Export to Excel (.xlsx)"
                        loading={exportingProductId === p._id}
                        disabled={exportingProductId !== null}
                        onClick={() => handleExportProduct(p)}
                        className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                      >
                        <FileSpreadsheet size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Job Time Management"
                        onClick={() => handleOpenDetails(p)}
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Timer size={15} />
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(p)}
                          className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Edit2 size={15} />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p)}
                          className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 animate-scale-up my-8 relative">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-slate-50 border-b border-slate-200 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <Ruler size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {isEditing ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isEditing
                      ? 'Update label dimensions, material, and job specifications'
                      : 'Create a dimension-based label specification'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </Button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 rounded-b-2xl">
              {/* Row 1: Product Friendly Name */}
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

              {/* Row 2: Width (mm) & Height (mm) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

              {/* Row 3: Job Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <SelectOrCreate
                  label="Job Name"
                  required
                  placeholder="Select Job Name..."
                  value={formData.jobName}
                  onChange={(val) => setFormData({ ...formData, jobName: val })}
                  options={jobNameOptions}
                  protectedOptions={PRESET_JOB_NAMES}
                  onCreateOption={(newJob) =>
                    setCustomJobNames((prev) => (prev.includes(newJob) ? prev : [...prev, newJob]))
                  }
                  onDeleteOption={(optVal) => handleDeleteOption('jobName', optVal)}
                  icon={Briefcase}
                  createPrompt="Add"
                />

                <SelectOrCreate
                  label="Category"
                  placeholder="Select Category..."
                  value={formData.category}
                  onChange={(val) => setFormData({ ...formData, category: val })}
                  options={categoryOptions}
                  protectedOptions={PRESET_CATEGORIES}
                  onCreateOption={(newCat) =>
                    setCustomCategories((prev) => (prev.includes(newCat) ? prev : [...prev, newCat]))
                  }
                  onDeleteOption={(optVal) => handleDeleteOption('category', optVal)}
                  icon={Tag}
                  createPrompt="Add"
                />
              </div>

              {/* Row 4: Material & Colour */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <SelectOrCreate
                  label="Material"
                  required
                  placeholder="Select Material..."
                  value={formData.material}
                  onChange={(val) => setFormData({ ...formData, material: val })}
                  options={materialOptions}
                  protectedOptions={PRESET_MATERIALS}
                  onCreateOption={(newMat) =>
                    setCustomMaterials((prev) => (prev.includes(newMat) ? prev : [...prev, newMat]))
                  }
                  onDeleteOption={(optVal) => handleDeleteOption('material', optVal)}
                  icon={Box}
                  createPrompt="Add"
                />

                <SelectOrCreate
                  label="Colour"
                  required
                  placeholder="Select Colour..."
                  value={formData.colour}
                  onChange={(val) => setFormData({ ...formData, colour: val })}
                  options={colourOptions}
                  protectedOptions={PRESET_COLOURS}
                  onCreateOption={(newCol) =>
                    setCustomColours((prev) => (prev.includes(newCol) ? prev : [...prev, newCol]))
                  }
                  onDeleteOption={(optVal) => handleDeleteOption('colour', optVal)}
                  icon={Palette}
                  createPrompt="Add"
                />
              </div>

              {/* Row 5: Default Usage Cycle & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <SelectOrCreate
                  label="Default Usage Cycle"
                  placeholder="Select Usage Cycle..."
                  value={formData.defaultUsageCycleDays}
                  onChange={(val) => {
                    const numVal = parseInt(String(val).replace(/\D/g, ''), 10);
                    setFormData({
                      ...formData,
                      defaultUsageCycleDays: !isNaN(numVal) && numVal > 0 ? numVal : val
                    });
                  }}
                  options={usageCycleOptions}
                  protectedOptions={PRESET_USAGE_CYCLES.map((u) => u.value)}
                  onCreateOption={handleCustomUsageCycleCreate}
                  onDeleteOption={(optVal) => handleDeleteOption('usageCycle', optVal)}
                  icon={Clock}
                  createPrompt="Add custom cycle"
                  formatOptionLabel={(opt) => {
                    if (typeof opt === 'object' && opt.label) return opt.label;
                    return `${opt} Days`;
                  }}
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full min-h-[42px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-medium focus:bg-white focus:border-red-500 transition cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={isSubmitting}
                >
                  {isEditing ? 'Save Changes' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Details & Job Time Management Modal */}
      <ProductDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedProductForDetails(null);
        }}
        product={selectedProductForDetails}
        onUpdateProduct={handleProductUpdated}
      />
    </div>
  );
}

