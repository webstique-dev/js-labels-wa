const ExcelJS = require('exceljs');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

function cleanStr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim().replace(/\s+/g, ' ');
  if (typeof v === 'number') return String(v).trim();
  if (typeof v === 'object') {
    if (v.text) return String(v.text).trim().replace(/\s+/g, ' ');
    if (v.result) return String(v.result).trim().replace(/\s+/g, ' ');
  }
  return String(v).trim();
}

function parseItemDimensions(itemStr) {
  if (!itemStr) return { width: 0, height: 0, unit: 'MM', dimKey: 'N/A', jobName: '' };

  const parts = itemStr.split('/').map(s => s.trim());
  const jobName = parts.length > 1 ? parts[0] : '';

  const sizeMatch = itemStr.match(/(?:S\s*:\s*|SIZE\s*:\s*)?(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*(MM|MTR|M))?/i);
  if (sizeMatch) {
    const width = parseFloat(sizeMatch[1]);
    const height = parseFloat(sizeMatch[2]);
    let unit = 'MM';
    if (sizeMatch[3]) {
      const u = sizeMatch[3].toUpperCase();
      unit = (u === 'M' || u === 'MTR') ? 'MTR' : 'MM';
    } else if (height >= 300 || width >= 300) {
      unit = 'MTR';
    }
    const dimKey = unit === 'MTR' ? `${width}x${height} MTR` : `${width}x${height}`;
    return { width, height, unit, dimKey, jobName };
  }

  return { width: 0, height: 0, unit: 'MM', dimKey: 'N/A', jobName };
}

function findBestCustomer(allCustomers, { custName, phone, addr }) {
  const cleanName = custName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
  const cleanAddr = addr ? addr.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  // 1. Exact Name Match
  const byName = allCustomers.find(c => {
    const cName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cComp = (c.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return cName === cleanName || cComp === cleanName;
  });
  if (byName) return byName;

  // 2. Phone Match (at least 7 digits)
  if (cleanPhone && cleanPhone.length >= 7) {
    const byPhone = allCustomers.find(c => {
      const p1 = (c.phone || '').replace(/\D/g, '');
      const p2 = (c.phone2 || '').replace(/\D/g, '');
      const bp = (c.billingPhone || '').replace(/\D/g, '');
      return (p1 && (p1.includes(cleanPhone) || cleanPhone.includes(p1))) ||
             (p2 && p2.includes(cleanPhone)) ||
             (bp && bp.includes(cleanPhone));
    });
    if (byPhone) return byPhone;
  }

  // 3. Address Match
  if (cleanAddr && cleanAddr.length >= 10) {
    const byAddr = allCustomers.find(c => {
      const cAddr = (c.address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cAddr && (cAddr.includes(cleanAddr) || cleanAddr.includes(cAddr));
    });
    if (byAddr) return byAddr;
  }

  return null;
}

function findMatchingProduct(allProducts, itemName) {
  const cleanItem = itemName.toLowerCase().replace(/\s+/g, ' ');
  const { width, height, unit, dimKey, jobName } = parseItemDimensions(itemName);

  // Exact name match
  let product = allProducts.find(p => p.name.toLowerCase().trim() === cleanItem);
  if (product) return product;

  // Match by jobName + dimensions
  if (jobName && dimKey !== 'N/A') {
    product = allProducts.find(p => {
      const jobMatch = p.jobName && p.jobName.toLowerCase().replace(/\s+/g, '') === jobName.toLowerCase().replace(/\s+/g, '');
      const dimMatch = p.dimensionKey && (p.dimensionKey === dimKey || p.dimensionKey === `${width}x${height}`);
      return jobMatch && dimMatch;
    });
    if (product) return product;
  }

  // Match by dimension + name substring
  if (dimKey !== 'N/A') {
    product = allProducts.find(p => {
      const pNameClean = p.name.toLowerCase();
      const dimMatch = p.dimensionKey && (p.dimensionKey === dimKey || (p.widthMm === width && p.heightMm === height));
      return dimMatch && cleanItem.includes(pNameClean);
    });
    if (product) return product;
  }

  return null;
}

async function parseAndImportOrdersFromWorkbook(workbook, { createdBy = null } = {}) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Find header row and column map
  let headerRowNum = 1;
  const headerMap = {};

  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const candidate = {};

    row.eachCell((cell, colNumber) => {
      const text = cleanStr(cell.value).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!text) return;

      if (text.includes('invoicedate') || text === 'date' || text.includes('podate') || text.includes('orderdate')) {
        candidate.date = colNumber;
      }
      if (text.includes('customername') || text === 'customer' || text === 'displayname' || text.includes('client')) {
        candidate.customer = colNumber;
      }
      if (text.includes('itemname') || text === 'item' || text === 'product' || text.includes('productname')) {
        candidate.item = colNumber;
      }
      if (text.includes('itemdesc') || text.includes('desc') || text.includes('description')) {
        candidate.desc = colNumber;
      }
      if (text.includes('quantity') || text === 'qty') {
        candidate.qty = colNumber;
      }
      if (text.includes('billingaddress') || text === 'address') {
        candidate.address = colNumber;
      }
      if (text.includes('street2') || text.includes('address2')) {
        candidate.street2 = colNumber;
      }
      if (text.includes('city')) {
        candidate.city = colNumber;
      }
      if (text.includes('mobile') || text.includes('contactmobile')) {
        candidate.mobile = colNumber;
      }
      if (text.includes('phone') && !text.includes('mobile')) {
        candidate.phone = colNumber;
      }
    });

    if (candidate.item && (candidate.customer || candidate.date)) {
      headerRowNum = r;
      Object.assign(headerMap, candidate);
      break;
    }
  }

  // Fallbacks
  if (!headerMap.date) headerMap.date = 1;
  if (!headerMap.customer) headerMap.customer = 2;
  if (!headerMap.item) headerMap.item = 3;
  if (!headerMap.desc) headerMap.desc = 4;
  if (!headerMap.qty) headerMap.qty = 5;
  if (!headerMap.address) headerMap.address = 6;
  if (!headerMap.street2) headerMap.street2 = 7;
  if (!headerMap.city) headerMap.city = 8;
  if (!headerMap.mobile) headerMap.mobile = 14;
  if (!headerMap.phone) headerMap.phone = 15;

  const allProducts = await Product.find({ isDeleted: { $ne: true } });
  const allCustomers = await Customer.find({ isDeleted: { $ne: true } });

  // Group consecutive rows with same Customer + Date
  const orderGroups = [];
  let currentGroup = null;

  for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || !row.hasValues) continue;

    const dateVal = row.getCell(headerMap.date).value;
    const invoiceDate = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const dateStr = !isNaN(invoiceDate.getTime()) ? invoiceDate.toISOString().split('T')[0] : 'NO_DATE';

    const custName = cleanStr(row.getCell(headerMap.customer).value);
    const itemName = cleanStr(row.getCell(headerMap.item).value);
    const itemDesc = cleanStr(row.getCell(headerMap.desc).value);
    const qty = parseFloat(cleanStr(row.getCell(headerMap.qty).value)) || 1;
    const addr = [cleanStr(row.getCell(headerMap.address).value), cleanStr(row.getCell(headerMap.street2).value)].filter(Boolean).join(', ');
    const phone = cleanStr(row.getCell(headerMap.mobile).value) || cleanStr(row.getCell(headerMap.phone).value);

    if (!itemName) continue;

    const groupKey = `${custName}:::${dateStr}`;

    if (!currentGroup || currentGroup.groupKey !== groupKey) {
      const customer = findBestCustomer(allCustomers, { custName, phone, addr });

      currentGroup = {
        groupKey,
        custName,
        customer,
        invoiceDate,
        deliveryAddress: addr || customer?.address || '',
        items: []
      };
      orderGroups.push(currentGroup);
    }

    currentGroup.items.push({
      itemName,
      itemDesc,
      qty,
      rowNumber: r
    });
  }

  let productsUpdatedCount = 0;
  let productsCreatedCount = 0;
  let createdOrdersCount = 0;
  const errors = [];

  // Determine starting order sequence count for the current date or overall
  const existingOrderCount = await Order.countDocuments();

  for (let i = 0; i < orderGroups.length; i++) {
    const ordGroup = orderGroups[i];
    const { customer, invoiceDate, deliveryAddress, items } = ordGroup;

    if (!customer) {
      errors.push(`Row(s) for "${ordGroup.custName}": Customer could not be matched with database.`);
      continue;
    }

    const lineItems = [];
    let orderAmountTotal = 0;
    let hasPricedLine = false;

    for (const item of items) {
      const { itemName, itemDesc, qty } = item;
      const { width, height, unit, dimKey, jobName } = parseItemDimensions(itemName);

      let product = findMatchingProduct(allProducts, itemName);

      if (product) {
        if (itemDesc && (!product.description || !product.notes)) {
          if (!product.description) product.description = itemDesc;
          if (!product.notes) product.notes = itemDesc;
          await product.save();
          productsUpdatedCount++;
        }
      } else {
        product = new Product({
          name: itemName,
          description: itemDesc || '',
          notes: itemDesc || '',
          jobName: jobName || '',
          widthMm: width,
          heightMm: height,
          unit: unit,
          category: 'General',
          status: 'active'
        });
        await product.save();
        allProducts.push(product);
        productsCreatedCount++;
      }

      const price = product.unitPrice || null;
      let lineTotal = null;
      if (price != null && !isNaN(price)) {
        lineTotal = Math.round(price * qty * 100) / 100;
        orderAmountTotal += lineTotal;
        hasPricedLine = true;
      }

      lineItems.push({
        productId: product._id,
        dimensionKey: product.dimensionKey || dimKey || 'N/A',
        name: product.name,
        description: itemDesc || '',
        qty: qty,
        price: price,
        lineTotal: lineTotal
      });
    }

    const dateFormatted = !isNaN(invoiceDate.getTime())
      ? invoiceDate.toISOString().slice(0, 10).replace(/-/g, '')
      : '20261000';
    const orderNo = `ORD-${dateFormatted}-${String(existingOrderCount + i + 1).padStart(3, '0')}`;

    const orderDoc = new Order({
      orderNo,
      customerId: customer._id,
      orderDate: invoiceDate,
      poDate: invoiceDate,
      amount: hasPricedLine ? orderAmountTotal : null,
      status: 'confirmed',
      deliveryAddress: deliveryAddress || customer.address || '',
      salesExecutive: customer.salesExecutive || (createdBy ? createdBy._id : null),
      notes: `Invoice import on ${invoiceDate.toISOString().split('T')[0]}`,
      lineItems
    });

    await orderDoc.save();
    createdOrdersCount++;

    // Sync Customer expectedReorderDate if this order is more recent
    if (!customer.expectedReorderDate || new Date(customer.expectedReorderDate) < invoiceDate) {
      const cycleDays = customer.usageCycleDays || 30;
      const expectedDate = new Date(invoiceDate.getTime() + (cycleDays * 24 * 60 * 60 * 1000));
      customer.expectedReorderDate = expectedDate;
      await customer.save();
    }
  }

  return {
    totalParsedLineItems: worksheet.rowCount - headerRowNum,
    totalOrderGroups: orderGroups.length,
    createdOrdersCount,
    productsCreatedCount,
    productsUpdatedCount,
    errors
  };
}

module.exports = {
  cleanStr,
  parseItemDimensions,
  findBestCustomer,
  findMatchingProduct,
  parseAndImportOrdersFromWorkbook
};

