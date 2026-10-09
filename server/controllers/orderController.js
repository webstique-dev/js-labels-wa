const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { calculateCustomerReorderProbability } = require('../utils/reorderCalculator');
const ExcelJS = require('exceljs');

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const { status, from, to, page = 1, limit = 50 } = req.query;

    let queryFilter = { ...req.scopeFilter };

    if (status && status !== 'all') queryFilter.status = status;

    if (from || to) {
      queryFilter.orderDate = {};
      if (from) queryFilter.orderDate.$gte = new Date(from);
      if (to) queryFilter.orderDate.$lte = new Date(to);
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [orders, total, allOrdersForSummary] = await Promise.all([
      Order.find(queryFilter)
        .populate('customerId', 'name company phone email city')
        .populate('salesExecutive', 'name email avatarUrl role')
        .populate('lineItems.productId', 'name widthMm heightMm dimensionKey category unitPrice')
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Order.countDocuments(queryFilter),
      Order.find(req.scopeFilter || {})
    ]);

    const summary = {
      totalOrders: allOrdersForSummary.length,
      statusCounts: {
        pending: 0,
        confirmed: 0,
        production: 0,
        quality_check: 0,
        dispatched: 0,
        delivered: 0,
        cancelled: 0
      },
      totalRevenue: 0
    };

    allOrdersForSummary.forEach((o) => {
      if (summary.statusCounts[o.status] !== undefined) {
        summary.statusCounts[o.status] += 1;
      }
      if (o.status !== 'cancelled' && o.amount != null && !isNaN(o.amount)) {
        summary.totalRevenue += o.amount;
      }
    });

    return res.json({
      orders,
      total,
      summary,
      page: parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)) || 1
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ message: 'Server error fetching orders' });
  }
};

// GET /api/orders/summary
const getOrdersSummary = async (req, res) => {
  try {
    const { from, to } = req.query;

    let queryFilter = { ...req.scopeFilter };

    if (from || to) {
      queryFilter.orderDate = {};
      if (from) queryFilter.orderDate.$gte = new Date(from);
      if (to) queryFilter.orderDate.$lte = new Date(to);
    }

    const orders = await Order.find(queryFilter);

    const summary = {
      totalOrders: orders.length,
      pending: 0,
      confirmed: 0,
      production: 0,
      quality_check: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0
    };

    orders.forEach((o) => {
      if (summary[o.status] !== undefined) {
        summary[o.status] += 1;
      }
      if (o.status !== 'cancelled' && o.amount != null && !isNaN(o.amount)) {
        summary.totalRevenue += o.amount;
      }
    });

    return res.json(summary);
  } catch (error) {
    console.error('Error computing order summary:', error);
    return res.status(500).json({ message: 'Server error computing order summary' });
  }
};

// POST /api/orders
const createOrder = async (req, res) => {
  try {
    let {
      customerId,
      newCustomer,
      lineItems,
      deliveryDate,
      expectedReorderDate,
      isExpectedReorderDateOverridden,
      usageCycleDays,
      leadId,
      poNumber,
      advanceReceived,
      advanceAmount,
      deliveryAddress,
      notes
    } = req.body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }

    if (!expectedReorderDate || isNaN(new Date(expectedReorderDate).getTime())) {
      return res.status(400).json({ message: 'Expected Reorder Date is required and must be a valid date' });
    }

    const parsedExpectedReorderDate = new Date(expectedReorderDate);
    const execId = req.user?.id || req.user?._id || undefined;

    // 1. If customerId is not provided, create Customer inline
    if (!customerId) {
      if (!newCustomer || !newCustomer.name || !newCustomer.phone) {
        return res.status(400).json({ message: 'Customer selection or new customer details are required' });
      }

      const cleanPhone = (newCustomer.phone || '').toString().replace(/\D/g, '').slice(0, 10);
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: 'Customer phone number must be 10 digits' });
      }

      const createdCustomer = await Customer.create({
        name: newCustomer.name.trim(),
        company: newCustomer.company ? newCustomer.company.trim() : undefined,
        phone: cleanPhone,
        email: newCustomer.email ? newCustomer.email.trim().toLowerCase() : undefined,
        city: newCustomer.city || undefined,
        address: deliveryAddress || newCustomer.address,
        gstNo: newCustomer.gstNo ? newCustomer.gstNo.trim() : undefined,
        leadId: leadId || newCustomer.leadId,
        salesExecutive: execId,
        expectedReorderDate: parsedExpectedReorderDate
      });

      customerId = createdCustomer._id;
    }

    // 2. Validate and process line items from Product catalog
    let allPriced = true;
    let computedAmount = 0;
    const processedLineItems = [];

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.productId) {
        return res.status(400).json({ message: `Item #${i + 1}: Product selection is required` });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `Item #${i + 1}: Referenced product not found` });
      }

      const qty = parseInt(item.qty, 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: `Item #${i + 1}: Quantity must be a positive number` });
      }

      // Copy dimensionKey and name directly from Product
      const dimensionKey = product.dimensionKey || `${product.widthMm}x${product.heightMm}`;
      const name = product.name;

      let price = null;
      let lineTotal = null;

      if (item.price !== undefined && item.price !== null && item.price !== '') {
        const parsedPrice = parseFloat(item.price);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          price = parsedPrice;
          lineTotal = qty * price;
          computedAmount += lineTotal;
        } else {
          allPriced = false;
        }
      } else {
        allPriced = false;
      }

      processedLineItems.push({
        productId: product._id,
        dimensionKey,
        name,
        qty,
        price,
        lineTotal
      });
    }

    // Amount is only computed/stored if all line items have pricing set
    const finalOrderAmount = allPriced ? computedAmount : null;

    // 3. Auto-generate Order Number
    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;

    // 4. Create Order
    const newOrder = await Order.create({
      orderNo,
      customerId,
      orderDate: new Date(),
      amount: finalOrderAmount,
      status: 'confirmed',
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      expectedReorderDate: parsedExpectedReorderDate,
      isExpectedReorderDateOverridden: Boolean(isExpectedReorderDateOverridden),
      salesExecutive: execId,
      usageCycleDays: parseInt(usageCycleDays, 10) || 30,
      poNumber: poNumber ? poNumber.trim() : undefined,
      advanceReceived: Boolean(advanceReceived),
      advanceAmount: parseFloat(advanceAmount) || 0,
      deliveryAddress: deliveryAddress ? deliveryAddress.trim() : undefined,
      notes: notes ? notes.trim() : undefined,
      lineItems: processedLineItems
    });

    // 5. IMMEDIATELY update related Customer's expectedReorderDate & reorderProbability
    const customer = await Customer.findById(customerId);
    if (customer) {
      customer.expectedReorderDate = parsedExpectedReorderDate;
      customer.reorderProbability = await calculateCustomerReorderProbability(customer._id, parsedExpectedReorderDate);
      await customer.save();
    }

    // 6. Create Activity Entry for Customer
    if (execId) {
      const priceText = finalOrderAmount != null
        ? `for ₹${finalOrderAmount.toLocaleString('en-IN')}`
        : `(pricing not tracked)`;

      await Activity.create({
        relatedType: 'customer',
        relatedId: customerId,
        type: 'status_change',
        description: `Order ${orderNo} (${newOrder.status.toUpperCase()}) created ${priceText}`,
        createdBy: execId
      });
    }

    // 7. If converted from Lead, update Lead status to 'won'
    if (leadId) {
      const lead = await Lead.findById(leadId);
      if (lead) {
        lead.status = 'won';
        await lead.save();

        if (execId) {
          await Activity.create({
            relatedType: 'lead',
            relatedId: leadId,
            type: 'status_change',
            description: `Lead converted to Order ${orderNo}`,
            createdBy: execId
          });
        }
      }
    }

    const populatedOrder = await Order.findById(newOrder._id)
      .populate('customerId', 'name company phone email city')
      .populate('salesExecutive', 'name email avatarUrl role')
      .populate('lineItems.productId', 'name widthMm heightMm dimensionKey category unitPrice');

    return res.status(201).json(populatedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A record with this phone number or details already exists' });
    }
    return res.status(500).json({ message: error.message || 'Server error creating order' });
  }
};

// PATCH /api/orders/:id - Edit existing order details
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      deliveryDate,
      expectedReorderDate,
      isExpectedReorderDateOverridden,
      usageCycleDays,
      poNumber,
      deliveryAddress,
      notes,
      lineItems
    } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'caller' && order.salesExecutive?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only update your own orders' });
    }

    if (deliveryDate !== undefined) order.deliveryDate = deliveryDate ? new Date(deliveryDate) : undefined;
    if (usageCycleDays !== undefined) order.usageCycleDays = parseInt(usageCycleDays, 10) || 30;
    if (poNumber !== undefined) order.poNumber = poNumber ? poNumber.trim() : undefined;
    if (deliveryAddress !== undefined) order.deliveryAddress = deliveryAddress ? deliveryAddress.trim() : undefined;
    if (notes !== undefined) order.notes = notes ? notes.trim() : undefined;

    // If lineItems are updated
    if (lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
      let allPriced = true;
      let computedAmount = 0;
      const processedLineItems = [];

      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        if (!item.productId) {
          return res.status(400).json({ message: `Item #${i + 1}: Product selection is required` });
        }

        const product = await Product.findById(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Item #${i + 1}: Referenced product not found` });
        }

        const qty = parseInt(item.qty, 10);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ message: `Item #${i + 1}: Quantity must be a positive number` });
        }

        const dimensionKey = product.dimensionKey || `${product.widthMm}x${product.heightMm}`;
        const name = product.name;

        let price = null;
        let lineTotal = null;

        if (item.price !== undefined && item.price !== null && item.price !== '') {
          const parsedPrice = parseFloat(item.price);
          if (!isNaN(parsedPrice) && parsedPrice >= 0) {
            price = parsedPrice;
            lineTotal = qty * price;
            computedAmount += lineTotal;
          } else {
            allPriced = false;
          }
        } else {
          allPriced = false;
        }

        processedLineItems.push({
          productId: product._id,
          dimensionKey,
          name,
          qty,
          price,
          lineTotal
        });
      }

      order.lineItems = processedLineItems;
      order.amount = allPriced ? computedAmount : null;
    }

    if (expectedReorderDate && !isNaN(new Date(expectedReorderDate).getTime())) {
      const parsedDate = new Date(expectedReorderDate);
      order.expectedReorderDate = parsedDate;
      if (isExpectedReorderDateOverridden !== undefined) {
        order.isExpectedReorderDateOverridden = Boolean(isExpectedReorderDateOverridden);
      }

      // Sync customer expectedReorderDate & probability
      const customer = await Customer.findById(order.customerId);
      if (customer) {
        customer.expectedReorderDate = parsedDate;
        customer.reorderProbability = await calculateCustomerReorderProbability(customer._id, parsedDate);
        await customer.save();
      }
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customerId', 'name company phone email city')
      .populate('salesExecutive', 'name email avatarUrl role')
      .populate('lineItems.productId', 'name widthMm heightMm dimensionKey category unitPrice');

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return res.status(500).json({ message: 'Server error updating order' });
  }
};

// PATCH /api/orders/:id/status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'production', 'quality_check', 'dispatched', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && order.salesExecutive?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only update your own orders' });
    }

    const oldStatus = order.status;
    order.status = status;

    if (oldStatus !== status) {
      // Delivered status handling
      if (status === 'delivered') {
        if (!order.deliveryDate) {
          order.deliveryDate = new Date();
        }

        const customer = await Customer.findById(order.customerId);

        if (order.isExpectedReorderDateOverridden) {
          // If manually overridden, do NOT recalculate automatically. Log activity note.
          if (customer) {
            await Activity.create({
              relatedType: 'customer',
              relatedId: customer._id,
              type: 'note',
              description: 'Delivery date differs from original plan — expected reorder date was manually set and was not recalculated',
              createdBy: req.user.id
            });
          }
        } else {
          // If NOT manually overridden, recalculate based on actual delivery date + usageCycleDays
          const cycleDays = order.usageCycleDays || 30;
          const recomputedReorderDate = new Date(order.deliveryDate.getTime() + (cycleDays * 24 * 60 * 60 * 1000));
          order.expectedReorderDate = recomputedReorderDate;

          if (customer) {
            customer.expectedReorderDate = recomputedReorderDate;
            customer.reorderProbability = await calculateCustomerReorderProbability(customer._id, recomputedReorderDate);
            await customer.save();
          }
        }
      }

      const activityDesc = status === 'delivered'
        ? `Order ${order.orderNo || ''} delivered.`
        : `Order ${order.orderNo || ''} status updated from ${oldStatus.toUpperCase()} to ${status.toUpperCase()}`;

      await Activity.create({
        relatedType: 'customer',
        relatedId: order.customerId,
        type: 'status_change',
        description: activityDesc,
        createdBy: req.user.id
      });
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customerId', 'name company phone email city')
      .populate('salesExecutive', 'name email avatarUrl role')
      .populate('lineItems.productId', 'name widthMm heightMm dimensionKey category unitPrice');

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ message: 'Server error updating order status' });
  }
};

// DELETE /api/orders/:id
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    await order.softDelete(req.user.id);

    await Activity.create({
      relatedType: 'customer',
      relatedId: order.customerId,
      type: 'status_change',
      description: `Order ${order.orderNo || ''} was deleted`,
      createdBy: req.user.id
    });

    return res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ message: 'Server error deleting order' });
  }
};

// GET /api/orders/export-all
const exportAllOrdersExcel = async (req, res) => {
  try {
    const { status, from, to } = req.query;

    let queryFilter = { ...req.scopeFilter };
    if (status && status !== 'all') queryFilter.status = status;

    if (from || to) {
      queryFilter.orderDate = {};
      if (from) queryFilter.orderDate.$gte = new Date(from);
      if (to) queryFilter.orderDate.$lte = new Date(to);
    }

    const orders = await Order.find(queryFilter)
      .populate('customerId', 'name company phone email city address deliveryAddress')
      .populate('salesExecutive', 'name email role')
      .populate('lineItems.productId', 'name widthMm heightMm dimensionKey category material')
      .sort({ orderDate: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels CRM';
    workbook.lastModifiedBy = req.user.name || 'System User';
    workbook.created = new Date();
    workbook.modified = new Date();

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // ================= SHEET 1: All Orders Master =================
    const ordersSheet = workbook.addWorksheet('All Orders Register', {
      views: [{ showGridLines: true }]
    });

    // Title banner
    ordersSheet.mergeCells('A1:N1');
    const titleCell = ordersSheet.getCell('A1');
    titleCell.value = 'JS LABELS — ORDERS MASTER REGISTER';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ordersSheet.getRow(1).height = 32;

    ordersSheet.mergeCells('A2:N2');
    const subCell = ordersSheet.getCell('A2');
    const nowStr = new Date().toLocaleString('en-IN');
    subCell.value = `Exported on: ${nowStr}  |  Total Orders: ${orders.length}  |  Exported By: ${req.user.name || 'Admin'} (${req.user.role || 'Staff'})`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ordersSheet.getRow(2).height = 20;

    const colHeaders = [
      'Order No',
      'PO Date',
      'Customer Name',
      'Company Name',
      'Contact Phone',
      'City',
      'Order Status',
      'Total Quantity (Units)',
      'Primary Product(s)',
      'Expected Delivery Date',
      'Usage Cycle (Days)',
      'Sales Executive',
      'Delivery Address',
      'Order Notes'
    ];

    const hRow = ordersSheet.getRow(4);
    hRow.values = colHeaders;
    hRow.height = 26;
    hRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    let rowIdx = 5;
    orders.forEach((ord, index) => {
      const orderNo = ord.orderNo || `ORD-${ord._id.toString().slice(-6).toUpperCase()}`;
      const poDateStr = ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN') : 'N/A';
      const custName = ord.customerId?.name || 'N/A';
      const company = ord.customerId?.company || '-';
      const phone = ord.customerId?.phone || '-';
      const city = ord.customerId?.city || '-';
      const statusStr = (ord.status || 'confirmed').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      const totalUnits = (ord.lineItems || []).reduce((sum, item) => sum + (item.qty || 0), 0);
      const productNames = (ord.lineItems || [])
        .map(li => li.name || li.productId?.name || li.dimensionKey || '')
        .filter(Boolean)
        .join('; ') || 'Standard Labels';
      const deliveryDateStr = ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-IN') : 'Pending';
      const usageCycle = ord.usageCycleDays ? `${ord.usageCycleDays} days` : '-';
      const exec = ord.salesExecutive?.name || 'Unassigned';
      const address = ord.deliveryAddress || ord.customerId?.deliveryAddress || ord.customerId?.address || '-';
      const notes = ord.notes || '-';

      const row = ordersSheet.getRow(rowIdx);
      row.values = [
        orderNo,
        poDateStr,
        custName,
        company,
        phone,
        city,
        statusStr,
        totalUnits,
        productNames,
        deliveryDateStr,
        usageCycle,
        exec,
        address,
        notes
      ];
      row.height = 22;

      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: colNum === 8 ? 'right' : 'left' };
        if (index % 2 === 1) {
          cell.fill = zebraFill;
        }
      });

      rowIdx++;
    });

    ordersSheet.columns = [
      { key: 'A', width: 16 },
      { key: 'B', width: 14 },
      { key: 'C', width: 24 },
      { key: 'D', width: 24 },
      { key: 'E', width: 16 },
      { key: 'F', width: 16 },
      { key: 'G', width: 16 },
      { key: 'H', width: 22 },
      { key: 'I', width: 32 },
      { key: 'J', width: 18 },
      { key: 'K', width: 16 },
      { key: 'L', width: 20 },
      { key: 'M', width: 30 },
      { key: 'N', width: 30 }
    ];

    // ================= SHEET 2: Ordered Items Breakdown =================
    const itemsSheet = workbook.addWorksheet('Ordered Items Breakdown', {
      views: [{ showGridLines: true }]
    });

    const itemHeaders = [
      'Order No',
      'PO Date',
      'Customer Name',
      'Company Name',
      'Item #',
      'Product Name',
      'Dimension Key',
      'Dimensions (WxH mm)',
      'Category',
      'Quantity (Units)',
      'Order Status',
      'Expected Delivery'
    ];

    const itemHRow = itemsSheet.getRow(1);
    itemHRow.values = itemHeaders;
    itemHRow.height = 26;
    itemHRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    let itemRowIdx = 2;
    orders.forEach((ord) => {
      const orderNo = ord.orderNo || `ORD-${ord._id.toString().slice(-6).toUpperCase()}`;
      const poDateStr = ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN') : 'N/A';
      const custName = ord.customerId?.name || 'N/A';
      const company = ord.customerId?.company || '-';
      const statusStr = (ord.status || 'confirmed').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      const deliveryDateStr = ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-IN') : 'Pending';

      (ord.lineItems || []).forEach((li, liIdx) => {
        const p = li.productId || {};
        const prodName = li.name || p.name || 'Custom Label';
        const dimKey = li.dimensionKey || p.dimensionKey || '-';
        const dims = (p.widthMm && p.heightMm) ? `${p.widthMm}x${p.heightMm} mm` : '-';
        const category = p.category || '-';
        const qty = li.qty || 0;

        const row = itemsSheet.getRow(itemRowIdx);
        row.values = [
          orderNo,
          poDateStr,
          custName,
          company,
          liIdx + 1,
          prodName,
          dimKey,
          dims,
          category,
          qty,
          statusStr,
          deliveryDateStr
        ];
        row.height = 20;

        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: colNum === 10 ? 'right' : 'left' };
          if (itemRowIdx % 2 === 1) {
            cell.fill = zebraFill;
          }
        });

        itemRowIdx++;
      });
    });

    itemsSheet.columns = [
      { key: 'A', width: 16 },
      { key: 'B', width: 14 },
      { key: 'C', width: 24 },
      { key: 'D', width: 24 },
      { key: 'E', width: 10 },
      { key: 'F', width: 28 },
      { key: 'G', width: 18 },
      { key: 'H', width: 20 },
      { key: 'I', width: 16 },
      { key: 'J', width: 18 },
      { key: 'K', width: 16 },
      { key: 'L', width: 18 }
    ];

    const todayIso = new Date().toISOString().split('T')[0];
    const filename = `JS_Labels_Orders_Master_${todayIso}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting all orders to excel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error generating orders excel export' });
    }
  }
};

// GET /api/orders/:id/export-excel
const exportSingleOrderExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).setOptions({ includeDeleted: true })
      .populate('customerId')
      .populate('salesExecutive', 'name email phone avatarUrl role')
      .populate('lineItems.productId');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && order.salesExecutive?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only export orders assigned to you' });
    }

    const formattedOrderNo = order.orderNo || `ORD-${order._id.toString().slice(-6).toUpperCase()}`;
    const cust = order.customerId || {};
    const exec = order.salesExecutive || {};

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels CRM';
    workbook.lastModifiedBy = req.user.name || 'System User';
    workbook.created = new Date();
    workbook.modified = new Date();

    const orderSheet = workbook.addWorksheet('Order Dossier', {
      views: [{ showGridLines: true }]
    });

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    const headerFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const sectionFont = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const labelFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    const labelFont = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    const dataFont = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // Row 1: Header Banner
    orderSheet.mergeCells('A1:F1');
    const titleCell = orderSheet.getCell('A1');
    titleCell.value = `JS LABELS — ORDER DOSSIER: ${formattedOrderNo}`;
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    orderSheet.getRow(1).height = 32;

    // Row 2: Subtitle
    orderSheet.mergeCells('A2:F2');
    const subCell = orderSheet.getCell('A2');
    subCell.value = `Generated: ${new Date().toLocaleString('en-IN')}  |  Sales Executive: ${exec.name || 'Unassigned'}  |  Status: ${(order.status || 'confirmed').toUpperCase()}`;
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    orderSheet.getRow(2).height = 20;

    // Section 1: Customer Details
    orderSheet.mergeCells('A4:F4');
    const sec1 = orderSheet.getCell('A4');
    sec1.value = '1. CUSTOMER & ACCOUNT INFORMATION';
    sec1.font = sectionFont;
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sec1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    orderSheet.getRow(4).height = 24;

    const custRows = [
      ['Customer Name', cust.name || 'N/A', '', 'Company Name', cust.company || 'N/A', ''],
      ['Phone', cust.phone || 'N/A', '', 'Email', cust.email || 'N/A', ''],
      ['City', cust.city || 'N/A', '', 'Delivery Address', order.deliveryAddress || cust.deliveryAddress || cust.address || 'N/A', '']
    ];

    custRows.forEach((rVals, idx) => {
      const rNum = 5 + idx;
      orderSheet.getRow(rNum).values = [rVals[0], rVals[1], '', rVals[3], rVals[4], ''];
      orderSheet.mergeCells(`B${rNum}:C${rNum}`);
      orderSheet.mergeCells(`E${rNum}:F${rNum}`);

      ['A', 'D'].forEach(c => {
        const cell = orderSheet.getCell(`${c}${rNum}`);
        cell.fill = labelFill;
        cell.font = labelFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      ['B', 'E'].forEach(c => {
        const cell = orderSheet.getCell(`${c}${rNum}`);
        cell.font = dataFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      orderSheet.getRow(rNum).height = 20;
    });

    // Section 2: Order Information & Dates
    orderSheet.mergeCells('A9:F9');
    const sec2 = orderSheet.getCell('A9');
    sec2.value = '2. ORDER LOGISTICS & DATES';
    sec2.font = sectionFont;
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    sec2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    orderSheet.getRow(9).height = 24;

    const poDateStr = order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : 'N/A';
    const deliveryDateStr = order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'Pending';
    const expectedReorderStr = order.expectedReorderDate ? new Date(order.expectedReorderDate).toLocaleDateString('en-IN') : 'N/A';
    const statusFormatted = (order.status || 'confirmed').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    const orderRows = [
      ['Order Number', formattedOrderNo, '', 'PO Date', poDateStr, ''],
      ['Order Status', statusFormatted, '', 'Expected Delivery', deliveryDateStr, ''],
      ['Usage Cycle', order.usageCycleDays ? `${order.usageCycleDays} days` : 'N/A', '', 'Expected Next Reorder', expectedReorderStr, '']
    ];

    orderRows.forEach((rVals, idx) => {
      const rNum = 10 + idx;
      orderSheet.getRow(rNum).values = [rVals[0], rVals[1], '', rVals[3], rVals[4], ''];
      orderSheet.mergeCells(`B${rNum}:C${rNum}`);
      orderSheet.mergeCells(`E${rNum}:F${rNum}`);

      ['A', 'D'].forEach(c => {
        const cell = orderSheet.getCell(`${c}${rNum}`);
        cell.fill = labelFill;
        cell.font = labelFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      ['B', 'E'].forEach(c => {
        const cell = orderSheet.getCell(`${c}${rNum}`);
        cell.font = { ...dataFont, bold: true };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      orderSheet.getRow(rNum).height = 20;
    });

    // Section 3: Ordered Products & Specifications
    orderSheet.mergeCells('A14:F14');
    const sec3 = orderSheet.getCell('A14');
    sec3.value = '3. ORDERED PRODUCTS & SPECIFICATIONS';
    sec3.font = sectionFont;
    sec3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
    sec3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    orderSheet.getRow(14).height = 24;

    const itemColHeaders = [
      'Item #',
      'Product Name',
      'Dimension Key',
      'Dimensions (WxH mm)',
      'Category / Material',
      'Ordered Quantity (Units)'
    ];

    const itemHeaderRow = orderSheet.getRow(15);
    itemHeaderRow.values = itemColHeaders;
    itemHeaderRow.height = 24;
    itemHeaderRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    let currentItemRow = 16;
    let grandTotalUnits = 0;

    (order.lineItems || []).forEach((li, idx) => {
      const p = li.productId || {};
      const prodName = li.name || p.name || 'Custom Label';
      const dimKey = li.dimensionKey || p.dimensionKey || '-';
      const dims = (p.widthMm && p.heightMm) ? `${p.widthMm}x${p.heightMm} mm` : '-';
      const specs = [p.category, p.material].filter(Boolean).join(' • ') || '-';
      const qty = li.qty || 0;
      grandTotalUnits += qty;

      const row = orderSheet.getRow(currentItemRow);
      row.values = [
        idx + 1,
        prodName,
        dimKey,
        dims,
        specs,
        qty
      ];
      row.height = 20;

      row.eachCell((cell, colNum) => {
        cell.font = dataFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: colNum === 6 ? 'right' : 'left' };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });

      currentItemRow++;
    });

    // Total units row
    const totalRow = orderSheet.getRow(currentItemRow);
    totalRow.values = ['Total Units', '', '', '', '', grandTotalUnits];
    orderSheet.mergeCells(`A${currentItemRow}:E${currentItemRow}`);
    const totLabelCell = orderSheet.getCell(`A${currentItemRow}`);
    totLabelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    totLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totLabelCell.border = thinBorder;
    totLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    const totValCell = orderSheet.getCell(`F${currentItemRow}`);
    totValCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    totValCell.alignment = { vertical: 'middle', horizontal: 'right' };
    totValCell.border = thinBorder;
    totValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    totalRow.height = 22;

    // Section 4: Notes (if present)
    if (order.notes) {
      currentItemRow += 2;
      orderSheet.mergeCells(`A${currentItemRow}:F${currentItemRow}`);
      const sec4 = orderSheet.getCell(`A${currentItemRow}`);
      sec4.value = '4. ORDER NOTES & PRODUCTION INSTRUCTIONS';
      sec4.font = sectionFont;
      sec4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      sec4.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      orderSheet.getRow(currentItemRow).height = 22;

      currentItemRow++;
      orderSheet.mergeCells(`A${currentItemRow}:F${currentItemRow + 1}`);
      const notesCell = orderSheet.getCell(`A${currentItemRow}`);
      notesCell.value = order.notes;
      notesCell.font = dataFont;
      notesCell.border = thinBorder;
      notesCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    }

    orderSheet.columns = [
      { key: 'A', width: 14 },
      { key: 'B', width: 28 },
      { key: 'C', width: 18 },
      { key: 'D', width: 22 },
      { key: 'E', width: 26 },
      { key: 'F', width: 24 }
    ];

    const safeOrderNo = formattedOrderNo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const todayIso = new Date().toISOString().split('T')[0];
    const filename = `Order_${safeOrderNo}_${todayIso}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting order to excel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error generating order excel export' });
    }
  }
};

module.exports = {
  getOrders,
  getOrdersSummary,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  exportAllOrdersExcel,
  exportSingleOrderExcel
};
