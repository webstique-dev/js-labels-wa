import api from '../api/axios';

/**
 * Download Customer Excel Purchase & 360 Report directly.
 * 
 * @param {string} customerId - ID of customer to export
 * @param {string} customerName - Name of customer for friendly filename
 * @param {object} notify - Notification context instance
 */
export async function exportCustomerToExcel(customerId, customerName = 'Customer', notify = null) {
  if (!customerId) {
    if (notify) notify.error('Invalid customer ID for export');
    return false;
  }

  try {
    const res = await api.get(`/customers/${customerId}/export-excel`, {
      responseType: 'blob'
    });

    // Determine filename
    let filename = `Customer_Report_${customerName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    // Create Blob and trigger download
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (notify) {
      notify.success(`Excel report for "${customerName}" downloaded successfully!`);
    }
    return true;
  } catch (err) {
    console.error('Failed to export customer excel:', err);
    let errMsg = 'Failed to export customer report to Excel';

    // If response is a blob containing JSON error
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch (e) {
        // use default
      }
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    }

    if (notify) {
      notify.error(errMsg);
    }
    throw err;
  }
}

/**
 * Download Product Details & Job Time History Excel report.
 * 
 * @param {string} productId - ID of product to export
 * @param {string} productName - Name of product for friendly filename
 * @param {object} notify - Notification context instance
 */
export async function exportProductToExcel(productId, productName = 'Product', notify = null) {
  if (!productId) {
    if (notify) notify.error('Invalid product ID for export');
    return false;
  }

  try {
    const res = await api.get(`/products/${productId}/export-excel`, {
      responseType: 'blob'
    });

    const safeName = productName.replace(/[^a-zA-Z0-9_-]/g, '_');
    let filename = `${safeName}_ProductDetails.xlsx`;

    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (notify) {
      notify.success(`Product details for "${productName}" exported successfully!`);
    }
    return true;
  } catch (err) {
    console.error('Failed to export product excel:', err);
    let errMsg = 'Failed to export product details to Excel';

    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch (e) {
        // default
      }
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    }

    if (notify) {
      notify.error(errMsg);
    }
    throw err;
  }
}

/**
 * Download Complete Production Planning, Demand Forecast & Sales Excel Report
 * 
 * @param {object} options
 * @param {number} [options.trailingMonths=2] - Planning horizon trailing months
 * @param {object} [options.notify] - Notification context instance
 */
export async function exportAllProductionToExcel({ trailingMonths = 2, notify = null } = {}) {
  try {
    const res = await api.get(`/production/export-all?trailingMonths=${trailingMonths}`, {
      responseType: 'blob'
    });

    let filename = `JS_Labels_Production_Forecast_All_${new Date().toISOString().split('T')[0]}.xlsx`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (notify) {
      notify.success('Complete production forecast data downloaded successfully!');
    }
    return true;
  } catch (err) {
    console.error('Failed to export all production data to excel:', err);
    let errMsg = 'Failed to export production forecast data';

    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch (e) {
        // default
      }
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    }

    if (notify) {
      notify.error(errMsg);
    }
    throw err;
  }
}

/**
 * Download Individual Product Production & Demand Dossier Excel Report
 * 
 * @param {object} options
 * @param {string} options.productName - Name of the product
 * @param {string} [options.dimensionKey] - Dimension key of the product
 * @param {number} [options.trailingMonths=2] - Planning horizon trailing months
 * @param {object} [options.notify] - Notification context instance
 */
export async function exportProductProductionToExcel({ productName, dimensionKey = '', trailingMonths = 2, notify = null }) {
  if (!productName) {
    if (notify) notify.error('Product name is required for export');
    return false;
  }

  try {
    const params = new URLSearchParams({
      productName,
      trailingMonths: String(trailingMonths)
    });
    if (dimensionKey) params.append('dimensionKey', dimensionKey);

    const res = await api.get(`/production/export-product?${params.toString()}`, {
      responseType: 'blob'
    });

    const safeName = productName.replace(/[^a-zA-Z0-9_-]/g, '_');
    let filename = `${safeName}_Production_Dossier.xlsx`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (notify) {
      notify.success(`Production dossier for "${productName}" exported successfully!`);
    }
    return true;
  } catch (err) {
    console.error('Failed to export product production dossier to excel:', err);
    let errMsg = `Failed to export production dossier for "${productName}"`;

    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch (e) {
        // default
      }
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    }

    if (notify) {
      notify.error(errMsg);
    }
    throw err;
  }
}

/**
 * Download All Orders Master Register Excel report.
 * 
 * @param {object} options
 * @param {string} [options.status='all'] - Order status filter
 * @param {string} [options.from=''] - Start date filter
 * @param {string} [options.to=''] - End date filter
 * @param {object} [options.notify] - Notification context instance
 */
export async function exportAllOrdersToExcel({ status = 'all', from = '', to = '', notify = null } = {}) {
  try {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/orders/export-all${qs}`, {
      responseType: 'blob'
    });

    let filename = `JS_Labels_Orders_Master_${new Date().toISOString().split('T')[0]}.xlsx`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (notify) {
      notify.success('Orders master register downloaded successfully!');
    }
    return true;
  } catch (err) {
    console.error('Failed to export all orders to excel:', err);
    let errMsg = 'Failed to export orders to Excel';

    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch (e) {
        // default
      }
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    }

    if (notify) {
      notify.error(errMsg);
    }
    throw err;
  }
}

/**
 * Download Individual Order Dossier Excel report.
 * 
 * @param {string} orderId - ID of order to export
 * @param {string} [orderNo='Order'] - Order number for friendly filename
 * @param {object} [notify] - Notification context instance
 */
export async function exportSingleOrderToExcel(orderId, orderNo = 'Order', notify = null) {
  if (!orderId) {
    if (notify) notify.error('Order ID is required for export');
    return false;
  }

  try {
    const res = await api.get(`/orders/${orderId}/export-excel`, {
      responseType: 'blob'
    });

    const safeOrderNo = orderNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    let filename = `Order_${safeOrderNo}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const disposition = res.headers['content-disposition'];
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (notify) {
      notify.success(`Order dossier for "${orderNo}" downloaded successfully!`);
    }
    return true;
  } catch (err) {
    console.error('Failed to export order to excel:', err);
    let errMsg = `Failed to export order dossier for "${orderNo}"`;

    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const json = JSON.parse(text);
        if (json.message) errMsg = json.message;
      } catch (e) {
        // default
      }
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    }

    if (notify) {
      notify.error(errMsg);
    }
    throw err;
  }
}


