import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import {
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  CreditCard,
  Ruler,
  Search,
  Check,
  Clock,
  IndianRupee,
  Info
} from 'lucide-react';
import CustomDatePicker from './ui/DatePicker';
import { useNotification } from '../context/NotificationContext';
import LoadingButton from './ui/LoadingButton';

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
                      {p.unitPrice != null && (
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          ₹{p.unitPrice}
                        </span>
                      )}
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

  // Order Details
  const [deliveryDate, setDeliveryDate] = useState('');
  const [usageCycleDays, setUsageCycleDays] = useState(30);
  const [expectedReorderDate, setExpectedReorderDate] = useState('');
  const [isManualReorderOverride, setIsManualReorderOverride] = useState(false);

  // Auto-calculate expectedReorderDate when deliveryDate or usageCycleDays changes
  useEffect(() => {
    if (!isManualReorderOverride && deliveryDate) {
      const d = new Date(deliveryDate);
      if (!isNaN(d.getTime())) {
        const cycle = parseInt(usageCycleDays, 10) || 30;
        const calcDate = new Date(d.getTime() + cycle * 24 * 60 * 60 * 1000);
        const yyyy = calcDate.getFullYear();
        const mm = String(calcDate.getMonth() + 1).padStart(2, '0');
        const dd = String(calcDate.getDate()).padStart(2, '0');
        setExpectedReorderDate(`${yyyy}-${mm}-${dd}`);
      }
    }
  }, [deliveryDate, usageCycleDays, isManualReorderOverride]);

  // Collapsible "+ More Details" State
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [advanceReceived, setAdvanceReceived] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setUsageCycleDays(product.defaultUsageCycleDays);
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
        lineItems: lineItems.map(i => ({
          productId: i.productId,
          qty: parseInt(i.qty, 10),
          price: (i.price !== '' && i.price !== null && i.price !== undefined)
            ? parseFloat(i.price)
            : undefined
        })),
        deliveryDate: deliveryDate || undefined,
        expectedReorderDate: expectedReorderDate,
        isExpectedReorderDateOverridden: isManualReorderOverride,
        usageCycleDays: parseInt(usageCycleDays, 10) || 30,
        poNumber: poNumber.trim() || undefined,
        advanceReceived,
        advanceAmount: advanceReceived ? (parseFloat(advanceAmount) || 0) : 0,
        deliveryAddress: deliveryAddress.trim() || undefined,
        notes: notes.trim() || undefined
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

                    {/* Quantity and Optional Unit Price Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-start">
                      {/* Quantity Input */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.qty}
                          onChange={(e) => handleItemFieldChange(index, 'qty', e.target.value)}
                          placeholder="1000"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 font-mono"
                        />
                      </div>

                      {/* Optional Unit Price Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-slate-700">
                            Unit Price (₹)
                          </label>
                          <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.price}
                            onChange={(e) => handleItemFieldChange(index, 'price', e.target.value)}
                            placeholder={selectedProd?.unitPrice != null ? `Ref: ₹${selectedProd.unitPrice}` : 'e.g. 1.25'}
                            className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 font-mono"
                          />
                        </div>
                        {selectedProd?.unitPrice != null && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Reference price: ₹{selectedProd.unitPrice}
                          </p>
                        )}
                      </div>

                      {/* Line Total Display */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Line Total
                        </label>
                        <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between min-h-[38px]">
                          {itemLineTotal != null ? (
                            <span className="text-slate-900">₹{itemLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-slate-400 font-normal italic text-[11px]">Not tracked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grand Total Bar / Pricing Status */}
            {calculatedGrandTotal != null ? (
              <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-md">
                <span className="text-xs font-semibold uppercase tracking-wider">Order Total Amount</span>
                <span className="text-lg sm:text-xl font-bold text-emerald-400">
                  ₹{calculatedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-100 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Info size={15} className="text-slate-400 shrink-0" />
                  <span className="font-medium">Pricing status:</span>
                </div>
                <span className="font-semibold text-slate-500 italic">
                  Pricing not tracked for this order
                </span>
              </div>
            )}
          </div>

          {/* Section 3: Delivery & Reorder Settings */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-xs font-semibold uppercase text-slate-600 block">3. Delivery & Reorder Settings</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Delivery Date</label>
                <CustomDatePicker
                  selectedDate={deliveryDate}
                  onChange={(val) => setDeliveryDate(val)}
                  placeholder="Select target delivery date"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Usage Cycle (Days)</label>
                <select
                  value={usageCycleDays}
                  onChange={(e) => setUsageCycleDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value={30}>30 Days (Standard Labels)</option>
                  <option value={45}>45 Days (Extended Batch)</option>
                  <option value={60}>60 Days (Bimonthly Supply)</option>
                  <option value={90}>90 Days (Quarterly Supply)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expected Reorder Date *
                </label>
                <CustomDatePicker
                  selectedDate={expectedReorderDate}
                  onChange={(val) => {
                    setIsManualReorderOverride(true);
                    setExpectedReorderDate(val);
                  }}
                  placeholder="Select expected reorder date"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-normal">
              Auto-calculated from delivery date + usage cycle — you can adjust if needed
            </p>
          </div>

          {/* Collapsible "+ More Details" Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowMoreDetails(!showMoreDetails)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <FileText size={15} className="text-slate-500" />
                <span>+ More Details (PO, Advance Payment, Address & Notes)</span>
              </span>
              {showMoreDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showMoreDetails && (
              <div className="p-4 space-y-3.5 border-t border-slate-200 bg-slate-50/50">
                {/* PO / Reference Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    PO / Reference Number
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-8890"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Advance Received Toggle & Amount */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                      <CreditCard size={14} className="text-slate-400" />
                      <span>Advance Received?</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAdvanceReceived(false)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          !advanceReceived ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdvanceReceived(true)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          advanceReceived ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {advanceReceived && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Advance Amount Received (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}
                </div>

                {/* Delivery Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Delivery / Shipping Address
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="e.g. Plot 12, GIDC Industrial Estate, Vatva, Ahmedabad"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Internal Notes */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Internal Notes / Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any specific instructions for production or dispatch..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={isSubmitting}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-red-600/20 transition cursor-pointer"
            >
              Confirm & Create Order
            </LoadingButton>
          </div>

        </form>
      </div>
    </div>
  );
}
