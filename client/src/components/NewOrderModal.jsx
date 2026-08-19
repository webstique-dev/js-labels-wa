import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Trash2, X } from 'lucide-react';

export default function NewOrderModal({ isOpen, onClose, onSuccess, initialLead }) {
  const [products, setProducts] = useState([]);
  const [existingCustomers, setExistingCustomers] = useState([]);
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
    city: 'Mumbai',
    address: ''
  });

  // Line Items
  const [lineItems, setLineItems] = useState([
    { productId: '', qty: 1000, price: 0, lineTotal: 0 }
  ]);

  // Order Details
  const [deliveryDate, setDeliveryDate] = useState('');
  const [usageCycleDays, setUsageCycleDays] = useState(30);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sync initialLead prop if updated
  useEffect(() => {
    if (initialLead) {
      setCustomerMode('new');
      setNewCustomerForm({
        name: initialLead.name || '',
        company: initialLead.company || '',
        phone: initialLead.phone || '',
        email: initialLead.email || '',
        city: 'Mumbai',
        address: ''
      });
    }
  }, [initialLead]);

  // Load Products and Customers on Modal Open
  useEffect(() => {
    if (isOpen) {
      const fetchResources = async () => {
        try {
          setLoadingResources(true);
          const [prodRes, custRes] = await Promise.all([
            api.get('/products'),
            api.get('/customers')
          ]);
          setProducts(prodRes.data || []);
          setExistingCustomers(custRes.data?.customers || []);

          // Auto-select first product if line item empty
          if (prodRes.data?.length > 0 && (!lineItems[0].productId || lineItems[0].price === 0)) {
            const p1 = prodRes.data[0];
            setLineItems([
              {
                productId: p1._id,
                qty: 1000,
                price: p1.unitPrice,
                lineTotal: 1000 * p1.unitPrice
              }
            ]);
            setUsageCycleDays(p1.defaultUsageCycleDays || 30);
          }
        } catch (err) {
          console.error('Error loading order modal resources:', err);
        } finally {
          setLoadingResources(false);
        }
      };
      fetchResources();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Line Item Product Selection
  const handleProductChange = (index, productId) => {
    const selectedProd = products.find(p => p._id === productId);
    const updated = [...lineItems];
    const price = selectedProd ? selectedProd.unitPrice : 0;
    const qty = updated[index].qty || 1;

    updated[index] = {
      ...updated[index],
      productId,
      price,
      lineTotal: qty * price
    };

    setLineItems(updated);
    if (selectedProd && selectedProd.defaultUsageCycleDays) {
      setUsageCycleDays(selectedProd.defaultUsageCycleDays);
    }
  };

  // Handle Line Item Qty/Price Change
  const handleItemChange = (index, field, value) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    const qty = field === 'qty' ? (parseInt(value) || 0) : item.qty;
    const price = field === 'price' ? (parseFloat(value) || 0) : item.price;
    
    item.qty = qty;
    item.price = price;
    item.lineTotal = qty * price;
    updated[index] = item;
    setLineItems(updated);
  };

  const addLineItem = () => {
    const defaultProd = products[0];
    const price = defaultProd ? defaultProd.unitPrice : 0;
    setLineItems([
      ...lineItems,
      {
        productId: defaultProd ? defaultProd._id : '',
        qty: 1000,
        price,
        lineTotal: 1000 * price
      }
    ]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Grand Total Calculation
  const grandTotal = lineItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (customerMode === 'existing' && !selectedCustomerId) {
      setErrorMessage('Please select an existing customer');
      return;
    }

    if (customerMode === 'new' && (!newCustomerForm.name || !newCustomerForm.phone)) {
      setErrorMessage('Customer name and phone number are required');
      return;
    }

    if (lineItems.some(i => !i.productId || i.qty <= 0)) {
      setErrorMessage('All line items must have a selected product and valid quantity');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        customerId: customerMode === 'existing' ? selectedCustomerId : undefined,
        newCustomer: customerMode === 'new' ? newCustomerForm : undefined,
        leadId: initialLead?._id,
        lineItems: lineItems.map(i => ({ productId: i.productId, qty: i.qty, price: i.price })),
        deliveryDate: deliveryDate || undefined,
        usageCycleDays: parseInt(usageCycleDays) || 30
      };

      const res = await api.post('/orders', payload);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto scrollbar-hide">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {initialLead ? `Create Order for ${initialLead.name}` : 'Create New Order'}
            </h3>
            <p className="text-xs text-slate-500">
              {initialLead ? 'Converts lead into an active Customer and logs confirmed order' : 'Select customer and add product line items'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Customer Selection Section */}
          <div className="space-y-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-600">1. Customer Selection</span>
              {!initialLead && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomerMode('existing')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                      customerMode === 'existing' ? 'bg-slate-900 text-white' : 'bg-white border text-slate-600'
                    }`}
                  >
                    Existing Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('new')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                      customerMode === 'new' ? 'bg-slate-900 text-white' : 'bg-white border text-slate-600'
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={newCustomerForm.company}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, company: e.target.value })}
                    placeholder="e.g. Apex Pvt Ltd"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustomerForm.email}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-600">2. Order Line Items</span>
              <button
                type="button"
                onClick={addLineItem}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {lineItems.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {/* Product Dropdown */}
                  <div className="col-span-5">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Product</label>
                    <select
                      required
                      value={item.productId}
                      onChange={(e) => handleProductChange(index, e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="">Select Label Product</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} (₹{p.unitPrice})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 text-center"
                    />
                  </div>

                  {/* Line Total */}
                  <div className="col-span-3 text-right">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Total</label>
                    <span className="font-extrabold text-slate-900 text-xs">
                      ₹{item.lineTotal.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Delete button */}
                  <div className="col-span-1 text-center">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Grand Total Bar */}
            <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Order Total Amount</span>
              <span className="text-lg font-black text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Delivery & Reorder Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Usage Cycle (Days)</label>
              <select
                value={usageCycleDays}
                onChange={(e) => setUsageCycleDays(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
              >
                <option value={30}>30 Days (Standard Labels)</option>
                <option value={45}>45 Days (Extended Batch)</option>
              </select>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-md transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Order...' : 'Confirm & Create Order'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
