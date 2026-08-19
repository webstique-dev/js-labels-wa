import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useConfirm } from '../context/ConfirmContext';
import { Tag, Trash2, Plus, Search } from 'lucide-react';

export default function Products() {
  const { role } = useAuth();
  const notify = useNotification();
  const confirm = useConfirm();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canDelete = role === 'super_admin';

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products');
      setProducts(res.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      notify.error(err.response?.data?.message || 'Failed to fetch products catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDeleteProduct = async (id, name) => {
    const isConfirmed = await confirm({
      title: 'Move Product to Trash',
      message: `Are you sure you want to delete "${name}"? It will be soft-deleted to System Trash.`,
      confirmLabel: 'Move to Trash',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.delete(`/products/${id}`);
      notify.success(`Product "${name}" moved to Trash`);
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      notify.error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Products Catalog</h1>
          <p className="text-slate-500 text-sm mt-1 font-normal">Manage label products, unit pricing, and usage cycle defaults</p>
        </div>
        <div className="relative min-w-[220px]">
          <Search size={16} className="text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
            <Tag size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Products Found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <div key={p._id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-medium text-xs">
                    <Tag size={18} />
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteProduct(p._id, p.name)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Move to Trash"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mt-3">{p.name}</h3>
                <p className="text-xs text-slate-500 font-normal">Category: {p.category || 'General Labels'}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Unit Price</span>
                <span className="text-lg font-semibold text-slate-900">₹{p.unitPrice}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
