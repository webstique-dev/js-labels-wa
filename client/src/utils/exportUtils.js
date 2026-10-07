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

