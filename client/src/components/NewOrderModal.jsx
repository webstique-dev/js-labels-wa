import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  Ruler,
  Search,
  Check,
  Clock,
  Info
} from 'lucide-react';
import CustomDatePicker from './ui/DatePicker';
import SelectOrCreate from './ui/SelectOrCreate';
import Button from './ui/Button';
import { useNotification } from '../context/NotificationContext';

const PRESET_USAGE_CYCLES = [
  { value: 15, label: '15 Days (Bi-weekly)' },
  { value: 25, label: '25 Days (Custom Batch)' },
  { value: 30, label: '30 Days (Standard)' },
  { value: 45, label: '45 Days (Extended)' },
  { value: 60, label: '60 Days (Bimonthly)' },
  { value: 90, label: '90 Days (Quarterly)' }
];

/**
 * Safely adds integer days to a YYYY-MM-DD date string without timezone shifts
 */
function addDaysToDate(dateStr, days) {
  if (!dateStr) return '';
  const numDays = parseInt(days, 10);
  if (isNaN(numDays)) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dt = new Date(y, m, d);
  if (isNaN(dt.getTime())) return '';
  dt.setDate(dt.getDate() + numDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Searchable Product Dropdown Component for Order Line Items
 */
function SearchableProductSelect({ products, selectedProductId, onSelectProduct, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  const selectedProduct = useMemo(() => {
    return products.find(p => p._id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Filter products by search term (name, dimensionKey, or category)
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase().trim();
    const normalizedDim = term.replace(/\s*x\s*/g, 'x');

    return products.filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(term);
      const catMatch = (p.category || '').toLowerCase().includes(term);
      const dimKey = (p.dimensionKey || `${p.widthMm}x${p.heightMm}`).toLowerCase();
      const dimMatch = dimKey.includes(term) || dimKey.includes(normalizedDim);
      return nameMatch || catMatch || dimMatch;
    });
  }, [products, searchTerm]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Box */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 rounded-xl text-left flex items-center justify-between gap-2 text-xs transition cursor-pointer disabled:opacity-50"
      >
        {selectedProduct ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-[11px] rounded-md shadow-2xs shrink-0">
              <Ruler size={12} className="text-red-400 stroke-[2.5]" />
              {selectedProduct.dimensionKey || `${selectedProduct.widthMm}x${selectedProduct.heightMm}`}
            </span>
            <span className="font-semibold text-slate-900 truncate">
              {selectedProduct.name}
            </span>
            {selectedProduct.category && (
              <span className="text-[10px] text-slate-400 font-normal shrink-0">
                ({selectedProduct.category})
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 font-normal">
            -- Select product by dimension or name --
          </span>
        )}
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1.5 max-h-64 overflow-hidden flex flex-col">
          {/* Search Field */}
          <div className="relative">
            <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type dimension (e.g. 4x45) or name..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:border-red-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Product Items List */}
          <div className="overflow-y-auto scrollbar-hide space-y-1 max-h-48 pt-0.5">
            {filteredProducts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching products found
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = p._id === selectedProductId;
                const dimStr = p.dimensionKey || `${p.widthMm}x${p.heightMm}`;
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => {
                      onSelectProduct(p);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-2 text-xs cursor-pointer ${
                      isSelected
                        ? 'bg-red-50 border border-red-200 text-red-900'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-[10px] rounded-md shrink-0">
                        <Ruler size={11} className="text-red-400" />
                        {dimStr}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {p.category || 'General'} • {p.defaultUsageCycleDays || 30}d cycle
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected && <Check size={14} className="text-red-600" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewOrderModal({ isOpen, onClose, onSuccess, initialLead, initialCustomer }) {
  const notify = useNotification();
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Customer Mode: 'existing' or 'new'
  const [customerMode, setCustomerMode] = useState(initialLead ? 'new' : 'existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // New Customer Form State
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: initialLead?.name || '',
    company: initialLead?.company || '',
    phone: initialLead?.phone || '',
    email: initialLead?.email || '',
    city: '',
    address: ''
  });

  // Dimension-based Line Items from Product catalog
  // productId, qty, price (optional)
  const [lineItems, setLineItems] = useState([
    { productId: '', qty: 1000, price: '' }
  ]);

  // Order Details & Reorder Settings
  const [orderDate, setOrderDate] = useState(getTodayStr());
  const [usageCycleDays, setUsageCycleDays] = useState(30);
  const [customUsageCycles, setCustomUsageCycles] = useState([]);
  const [expectedReorderDate, setExpectedReorderDate] = useState(() => addDaysToDate(getTodayStr(), 30));
  const [isManualReorderOverride, setIsManualReorderOverride] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Combine Preset and Custom Usage Cycle options
  const allUsageCycleOptions = useMemo(() => {
    const list = [...PRESET_USAGE_CYCLES];
    customUsageCycles.forEach(c => {
      const val = parseInt(c, 10);
      if (!isNaN(val) && !list.some(item => item.value === val)) {
        list.push({ value: val, label: `${val} Days` });
      }
    });
    const currentVal = parseInt(usageCycleDays, 10);
    if (!isNaN(currentVal) && !list.some(item => item.value === currentVal)) {
      list.push({ value: currentVal, label: `${currentVal} Days` });
    }
    return list.sort((a, b) => a.value - b.value);
  }, [customUsageCycles, usageCycleDays]);

  // Handle Usage Cycle Change with automatic Expected Reorder Date update
  const handleUsageCycleChange = (val) => {
    const num = parseInt(String(val).replace(/\D/g, ''), 10);
    const validNum = !isNaN(num) && num > 0 ? num : 30;
    setUsageCycleDays(validNum);
    if (orderDate) {
      setExpectedReorderDate(addDaysToDate(orderDate, validNum));
      setIsManualReorderOverride(false);
    }
  };

  const handleCreateCustomCycle = (newVal) => {
    const num = parseInt(String(newVal).replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      setCustomUsageCycles(prev => (prev.includes(num) ? prev : [...prev, num]));
      handleUsageCycleChange(num);
    }
  };

  const handleDeleteCustomCycle = (optVal) => {
    const num = parseInt(String(optVal).replace(/\D/g, ''), 10);
    setCustomUsageCycles(prev => prev.filter(c => c !== num));
  };

  // Sync initialLead or initialCustomer props when modal opens
  useEffect(() => {
    if (initialLead) {
      setCustomerMode('new');
      setNewCustomerForm({
        name: initialLead.name || '',
        company: initialLead.company || '',
        phone: initialLead.phone || '',
        email: initialLead.email || '',
        city: '',
        address: ''
      });
    } else if (initialCustomer) {
      setCustomerMode('existing');
      const custId = typeof initialCustomer === 'string' ? initialCustomer : (initialCustomer._id || initialCustomer.id);
      setSelectedCustomerId(custId || '');
      if (initialCustomer.address) {
        setDeliveryAddress(initialCustomer.address);
      }
    }
  }, [initialLead, initialCustomer]);

  // Load Existing Customers & Products on Modal Open
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          setLoadingResources(true);
          const [custRes, prodRes] = await Promise.allSettled([
            api.get('/customers'),
            api.get('/products?limit=100&status=active')
          ]);

          if (custRes.status === 'fulfilled') {
            const cData = custRes.value.data;
            setExistingCustomers(Array.isArray(cData) ? cData : (cData?.customers || []));
          }

          if (prodRes.status === 'fulfilled') {
            const pData = prodRes.value.data;
            const prods = Array.isArray(pData) ? pData : (pData?.products || []);
            setProductsList(prods);

            // If line items is empty/unselected, pre-select first product if available
            setLineItems(prev => {
              if (prev.length === 1 && !prev[0].productId && prods.length > 0) {
                const first = prods[0];
                return [{ productId: first._id, qty: 1000, price: '' }];
              }
              return prev;
            });
          }
        } catch (err) {
          console.error('Error loading resources for order form:', err);
        } finally {
          setLoadingResources(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  // Handle Product Selection for a line item
  const handleSelectProduct = (index, product) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      productId: product._id
    };

    // Auto-fill Usage Cycle from product default if available
    if (product.defaultUsageCycleDays && index === 0) {
      const pCycle = parseInt(product.defaultUsageCycleDays, 10) || 30;
      setUsageCycleDays(pCycle);
      if (orderDate) {
        setExpectedReorderDate(addDaysToDate(orderDate, pCycle));
        setIsManualReorderOverride(false);
      }
    }

    setLineItems(updated);
  };

  // Handle Line Item Field Change
  const handleItemFieldChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { productId: '', qty: 1000, price: '' }
    ]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Grand Total Calculation (Only if ALL line items have price set)
  const isAllPriced = useMemo(() => {
    if (lineItems.length === 0) return false;
    return lineItems.every(item => {
      if (!item.productId) return false;
      if (item.price === '' || item.price === null || item.price === undefined) return false;
      const p = parseFloat(item.price);
      return !isNaN(p) && p >= 0;
    });
  }, [lineItems]);

  const calculatedGrandTotal = useMemo(() => {
    if (!isAllPriced) return null;
    return lineItems.reduce((sum, item) => {
      const qty = parseInt(item.qty, 10) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [lineItems, isAllPriced]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (customerMode === 'existing' && !selectedCustomerId) {
      notify.error('Please select an existing customer');
      return;
    }

    if (customerMode === 'new') {
      if (!newCustomerForm.name || !newCustomerForm.phone) {
        notify.error('Customer name and phone number are required');
        return;
      }
      const cleanPhone = newCustomerForm.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        notify.error('Phone number must be exactly 10 digits');
        return;
      }
      if (newCustomerForm.email && newCustomerForm.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newCustomerForm.email.trim())) {
          notify.error('Please enter a valid email address');
          return;
        }
      }
    }

    // Validate line items
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.productId) {
        notify.error(`Item #${i + 1}: Please select a product from the catalog`);
        return;
      }
      const qty = parseInt(item.qty, 10);
      if (isNaN(qty) || qty <= 0) {
        notify.error(`Item #${i + 1}: Valid Quantity is required`);
        return;
      }
    }

    if (!expectedReorderDate) {
      notify.error('Expected Reorder Date is required');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        customerId: customerMode === 'existing' ? selectedCustomerId : undefined,
        newCustomer: customerMode === 'new' ? newCustomerForm : undefined,
        leadId: initialLead?._id,
        orderDate: orderDate || undefined,
        lineItems: lineItems.map(i => ({
          productId: i.productId,
          qty: parseInt(i.qty, 10),
          price: (i.price !== '' && i.price !== null && i.price !== undefined)
            ? parseFloat(i.price)
            : undefined
        })),
        expectedReorderDate: expectedReorderDate,
        isExpectedReorderDateOverridden: isManualReorderOverride,
        usageCycleDays: parseInt(usageCycleDays, 10) || 30,
        deliveryAddress: deliveryAddress.trim() || undefined
      };

      const res = await api.post('/orders', payload);
      notify.success('Order created successfully');
      if (typeof onSuccess === 'function') {
        onSuccess(res.data);
      }
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      notify.error(err.response?.data?.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide font-sans">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {initialCustomer?.name
                ? `Create Order for ${initialCustomer.name}`
                : (initialLead ? `Create Order for ${initialLead.name}` : 'Create New Order')}
            </h3>
            <p className="text-xs text-slate-500">
              {initialCustomer?.name
                ? `Create a dimension-based label order for ${initialCustomer.name}`
                : (initialLead ? 'Converts lead into an active Customer and logs confirmed order' : 'Select customer and pick products from dimension catalog')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Section 1: Customer Selection Section */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-600">1. Customer Selection</span>
              {!initialLead && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerMode('existing')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      customerMode === 'existing' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    Existing Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('new')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      customerMode === 'new' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    + New Customer
                  </button>
                </div>
              )}
            </div>

            {customerMode === 'existing' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Customer *</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value="">-- Choose Existing Customer --</option>
                  {existingCustomers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.company ? `(${c.company})` : ''} - {c.phone}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.name}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    placeholder="e.g. Apex Logistics"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={newCustomerForm.company}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, company: e.target.value })}
                    placeholder="e.g. Apex Pvt Ltd"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    placeholder="contact@company.com (Optional)"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Dimension-Based Order Line Items from Product Catalog */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Ruler size={15} className="text-red-600" />
                <span className="text-xs font-semibold uppercase text-slate-700">
                  2. Order Line Items (Product Catalog)
                </span>
              </div>
              <button
                type="button"
                onClick={addLineItem}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => {
                const selectedProd = productsList.find(p => p._id === item.productId);
                const hasItemPrice = item.price !== '' && item.price !== null && !isNaN(parseFloat(item.price));
                const itemLineTotal = hasItemPrice
                  ? (parseInt(item.qty, 10) || 0) * parseFloat(item.price)
                  : null;

                return (
                  <div key={index} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Line Item #{index + 1}
                      </span>
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-slate-400 hover:text-red-600 p-1 transition cursor-pointer"
                          title="Remove Item"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {/* Searchable Product Dropdown */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Select Product (by Dimension or Name) <span className="text-red-500">*</span>
                      </label>
                      <SearchableProductSelect
                        products={productsList}
                        selectedProductId={item.productId}
                        onSelectProduct={(prod) => handleSelectProduct(index, prod)}
                      />
                    </div>

                    {/* Quantity Input */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Quantity (Labels) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.qty}
                        onChange={(e) => handleItemFieldChange(index, 'qty', e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 font-mono"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Section 3: Order Date & Reorder Settings */}
          <div className="space-y-3.5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-600 block">
                3. Order & Reorder Settings
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-start">
              {/* PO Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  PO Date <span className="text-red-500">*</span>
                </label>
                <CustomDatePicker
                  required
                  selectedDate={orderDate}
                  onChange={(val) => {
                    setOrderDate(val);
                    if (val && usageCycleDays) {
                      setExpectedReorderDate(addDaysToDate(val, usageCycleDays));
                      setIsManualReorderOverride(false);
                    }
                  }}
                  placeholder="Select PO date"
                />
              </div>

              {/* Usage Cycle (Days) - Select or Create */}
              <div className="space-y-1.5">
                <SelectOrCreate
                  label="Usage Cycle (Days)"
                  placeholder="Select or enter days..."
                  value={usageCycleDays}
                  onChange={handleUsageCycleChange}
                  options={allUsageCycleOptions}
                  protectedOptions={PRESET_USAGE_CYCLES.map(u => u.value)}
                  onCreateOption={handleCreateCustomCycle}
                  onDeleteOption={handleDeleteCustomCycle}
                  icon={Clock}
                  createPrompt="Add custom cycle"
                  formatSelectedLabel={(val) => {
                    const num = parseInt(String(val).replace(/\D/g, ''), 10);
                    return isNaN(num) ? String(val) : `${num} Days`;
                  }}
                  formatOptionLabel={(opt) => {
                    if (typeof opt === 'object' && opt.label) return opt.label;
                    const num = parseInt(String(opt).replace(/\D/g, ''), 10);
                    return isNaN(num) ? String(opt) : `${num} Days`;
                  }}
                />
              </div>

              {/* Expected Reorder Date */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Expected Reorder Date <span className="text-red-500">*</span>
                  </label>
                  {isManualReorderOverride ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Manual
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      Auto
                    </span>
                  )}
                </div>
                <CustomDatePicker
                  required
                  selectedDate={expectedReorderDate}
                  onChange={(val) => {
                    setIsManualReorderOverride(true);
                    setExpectedReorderDate(val);
                  }}
                  placeholder="Select expected reorder date"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-2xs">
              <Info size={14} className="text-red-500 shrink-0 stroke-[2.2]" />
              <span>
                Auto-calculated from <strong className="text-slate-900 font-bold">PO Date + {usageCycleDays || 30} Days</strong> — you can manually adjust if needed.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              loadingText="Creating Order..."
            >
              Confirm & Create Order
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
