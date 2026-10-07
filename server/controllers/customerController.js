const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Activity = require('../models/Activity');

const Lead = require('../models/Lead');

// Sync Won Leads into Customer Documents so all won leads appear in Customer Directory
const syncWonLeadsToCustomers = async () => {
  try {
    const wonLeads = await Lead.find({ status: 'won' });
    for (const lead of wonLeads) {
      const existingCust = await Customer.findOne({ $or: [{ leadId: lead._id }, { phone: lead.phone }] });
      if (!existingCust) {
        await Customer.create({
          name: lead.name,
          company: lead.company,
          phone: lead.phone,
          email: lead.email,
          leadId: lead._id,
          salesExecutive: lead.assignedTo,
          customerType: 'Regular',
          paymentTerms: '30 Days'
        });
      }
    }
  } catch (err) {
    console.warn('Error syncing won leads to customers:', err);
  }
};

// GET /api/customers
const getCustomers = async (req, res) => {
  try {
    await syncWonLeadsToCustomers();
    const { search, page = 1, limit = 50 } = req.query;

    let queryFilter = { ...req.scopeFilter };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      queryFilter.$or = [
        { name: searchRegex },
        { company: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { city: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [customers, total] = await Promise.all([
      Customer.find(queryFilter)
        .populate('salesExecutive', 'name email avatarUrl role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Customer.countDocuments(queryFilter)
    ]);

    return res.json({
      customers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ message: 'Server error fetching customers' });
  }
};

// POST /api/customers
const createCustomer = async (req, res) => {
  try {
    const { name, company, phone, email, gstNo, address, city, customerType, paymentTerms, creditLimit, tags } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    let cleanPhone = undefined;
    if (phone) {
      cleanPhone = phone.toString().replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
      }
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: 'Please enter a valid email address' });
      }
    }

    const customer = await Customer.create({
      name: name.trim(),
      company: company ? company.trim() : undefined,
      phone: cleanPhone || phone,
      email: email ? email.trim().toLowerCase() : undefined,
      gstNo,
      address,
      city,
      customerType: customerType || 'Regular',
      paymentTerms: paymentTerms || '30 Days',
      creditLimit: creditLimit || 100000,
      currentBalance: 0,
      tags: tags || ['Customer'],
      salesExecutive: req.user.role === 'caller' ? req.user.id : (req.body.salesExecutive || null)
    });

    await Activity.create({
      relatedType: 'customer',
      relatedId: customer._id,
      type: 'status_change',
      description: `New customer account created for ${customer.name}`,
      createdBy: req.user.id
    });

    return res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    return res.status(500).json({ message: 'Server error creating customer' });
  }
};

// GET /api/customers/:id
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id).setOptions({ includeDeleted: true })
      .populate('salesExecutive', 'name email phone avatarUrl role');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && customer.salesExecutive?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only view customers assigned to you' });
    }

    return res.json(customer);
  } catch (error) {
    console.error('Error fetching customer detail:', error);
    return res.status(500).json({ message: 'Server error fetching customer detail' });
  }
};

// GET /api/customers/:id/summary
const getCustomerSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const customerObjId = new mongoose.Types.ObjectId(id);

    // Fetch basic order metrics
    const orders = await Order.find({ customerId: customerObjId, isDeleted: { $ne: true } }).sort({ orderDate: -1 });

    const totalOrders = orders.length;
    const pricedOrders = orders.filter(o => o.amount != null && !isNaN(o.amount) && o.amount > 0);
    const pricedCount = pricedOrders.length;
    const hasPricing = pricedCount > 0;
    const totalSpent = hasPricing ? pricedOrders.reduce((sum, o) => sum + o.amount, 0) : null;
    const avgOrderValue = hasPricing ? Math.round(totalSpent / pricedCount) : null;
    const lastOrder = orders.length > 0 ? { orderDate: orders[0].orderDate || orders[0].createdAt, amount: orders[0].amount } : null;
    const repeatOrders = totalOrders > 1 ? totalOrders - 1 : 0;
    const repeatOrderRate = totalOrders > 0 ? Math.round((repeatOrders / totalOrders) * 100) : 0;

    // Aggregate Top Products across customer's orders
    const topProducts = await Order.aggregate([
      { $match: { customerId: customerObjId, isDeleted: { $ne: true }, status: { $ne: 'cancelled' } } },
      { $unwind: "$lineItems" },
      {
        $group: {
          _id: { $ifNull: ["$lineItems.productId", "$lineItems.name"] },
          name: { $first: "$lineItems.name" },
          dimensionKey: { $first: "$lineItems.dimensionKey" },
          totalQty: { $sum: "$lineItems.qty" },
          totalAmount: {
            $sum: {
              $cond: [
                { $gt: ["$lineItems.lineTotal", 0] },
                "$lineItems.lineTotal",
                { $multiply: ["$lineItems.qty", { $ifNull: ["$lineItems.price", 0] }] }
              ]
            }
          }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 }
    ]);

    return res.json({
      totalOrders,
      totalSpent,
      hasPricing,
      pricingCoverage: {
        pricedCount,
        totalCount: totalOrders
      },
      lastOrder,
      avgOrderValue,
      repeatOrders,
      repeatOrderRate,
      topProducts: topProducts || []
    });
  } catch (error) {
    console.error('Error computing customer summary:', error);
    return res.status(500).json({ message: 'Server error computing customer summary' });
  }
};

// GET /api/customers/:id/orders
const getCustomerOrders = async (req, res) => {
  try {
    const { id } = req.params;

    const orders = await Order.find({ customerId: id })
      .populate('salesExecutive', 'name email avatarUrl')
      .sort({ orderDate: -1 });

    return res.json(orders);
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    return res.status(500).json({ message: 'Server error fetching customer orders' });
  }
};

// GET /api/customers/:id/timeline
const getCustomerTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const customerOrders = await Order.find({ customerId: id }).select('_id');
    const orderIds = customerOrders.map(o => o._id);

    const queryFilter = {
      $or: [
        { relatedType: 'customer', relatedId: id },
        { relatedType: 'order', relatedId: { $in: orderIds } }
      ]
    };

    if (customer.leadId) {
      queryFilter.$or.push({ relatedType: 'lead', relatedId: customer.leadId });
    }

    const activities = await Activity.find(queryFilter)
      .populate('createdBy', 'name email avatarUrl role')
      .sort({ createdAt: -1 });

    return res.json(activities);
  } catch (error) {
    console.error('Error fetching customer timeline:', error);
    return res.status(500).json({ message: 'Server error fetching customer timeline' });
  }
};

// PUT or PATCH /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer account not found' });
    }

    const {
      name,
      company,
      phone,
      email,
      gstNo,
      address,
      city,
      customerType,
      source,
      priority,
      expectedReorderDate
    } = req.body;

    const cleanPhone = phone ? phone.toString().replace(/\D/g, '') : null;
    if (phone && cleanPhone.length !== 10) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits' });
    }

    if (name) customer.name = name.trim();
    if (company !== undefined) customer.company = company ? company.trim() : '';
    if (cleanPhone && cleanPhone.length === 10) customer.phone = cleanPhone;
    if (email !== undefined) customer.email = email ? email.trim().toLowerCase() : '';
    if (gstNo !== undefined) customer.gstNo = gstNo;
    if (address !== undefined) customer.address = address;
    if (city !== undefined) customer.city = city;
    if (customerType !== undefined) customer.customerType = customerType;
    if (source !== undefined) customer.source = source;
    if (priority !== undefined) customer.priority = priority;

    let parsedExpectedDate = undefined;
    if (expectedReorderDate) {
      const d = new Date(expectedReorderDate);
      if (!isNaN(d.getTime())) {
        parsedExpectedDate = d;
        customer.expectedReorderDate = parsedExpectedDate;
      }
    }

    await customer.save();

    // 1. Sync linked Lead if exists
    const Lead = require('../models/Lead');
    let linkedLead = null;
    if (customer.leadId) {
      linkedLead = await Lead.findById(customer.leadId);
    } else {
      linkedLead = await Lead.findOne({ phone: customer.phone });
    }

    if (linkedLead) {
      if (name) linkedLead.name = customer.name;
      if (company !== undefined) linkedLead.company = customer.company;
      if (cleanPhone && cleanPhone.length === 10) linkedLead.phone = customer.phone;
      if (email !== undefined) linkedLead.email = customer.email;
      if (gstNo !== undefined) linkedLead.gstNo = customer.gstNo;
      if (address !== undefined) linkedLead.address = customer.address;
      if (city !== undefined) linkedLead.city = customer.city;
      if (source) {
        const srcStr = source.toString().trim();
        const mapped = srcStr.toLowerCase().replace(/[\s-]+/g, '_');
        const validEnums = ['website', 'referral', 'walk_in', 'google_ads', 'tele_caller', 'other'];
        linkedLead.source = validEnums.includes(mapped) ? mapped : srcStr;
      }
      if (priority) linkedLead.priority = priority;
      if (parsedExpectedDate) linkedLead.nextFollowUpDate = parsedExpectedDate;
      await linkedLead.save();
    }

    // 2. Sync open FollowUp documents for customer and linked lead
    const FollowUp = require('../models/FollowUp');
    if (parsedExpectedDate) {
      await FollowUp.updateMany(
        { relatedType: 'customer', relatedId: customer._id, status: 'open' },
        { $set: { dueDate: parsedExpectedDate } }
      );
      if (linkedLead) {
        await FollowUp.updateMany(
          { relatedType: 'lead', relatedId: linkedLead._id, status: 'open' },
          { $set: { dueDate: parsedExpectedDate } }
        );
      }
    }

    // Create activity audit entry
    if (parsedExpectedDate) {
      const formattedDateStr = parsedExpectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      await Activity.create({
        relatedType: 'customer',
        relatedId: customer._id,
        type: 'reorder_date',
        description: `Updated Next Pre-order / Reorder date to ${formattedDateStr} (${customer.name})`,
        createdBy: req.user.id
      });
      if (linkedLead) {
        await Activity.create({
          relatedType: 'lead',
          relatedId: linkedLead._id,
          type: 'reorder_date',
          description: `Updated Next Pre-order / Reorder date to ${formattedDateStr} (${customer.name})`,
          createdBy: req.user.id
        });
      }
    } else {
      await Activity.create({
        relatedType: 'customer',
        relatedId: customer._id,
        type: 'status_change',
        description: `Updated customer details (${customer.name})`,
        createdBy: req.user.id
      });
    }

    const updatedCustomer = await Customer.findById(customer._id)
      .populate('salesExecutive', 'name email phone avatarUrl role');

    return res.json(updatedCustomer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return res.status(500).json({ message: 'Server error updating customer' });
  }
};

// GET /api/customers/:id/export-excel
const exportCustomerExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id).setOptions({ includeDeleted: true })
      .populate('salesExecutive', 'name email phone avatarUrl role');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Ownership check for caller
    if (req.user.role === 'caller' && customer.salesExecutive?._id?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You can only export customers assigned to you' });
    }

    // Fetch customer's orders and populated line items
    const orders = await Order.find({ customerId: id, isDeleted: { $ne: true } })
      .populate('lineItems.productId')
      .populate('salesExecutive', 'name email')
      .sort({ orderDate: -1 });

    // Fetch customer activities / timeline
    const orderIds = orders.map(o => o._id);
    const activities = await Activity.find({
      $or: [
        { relatedType: 'customer', relatedId: id },
        { relatedType: 'order', relatedId: { $in: orderIds } }
      ]
    }).populate('createdBy', 'name email role').sort({ createdAt: -1 });

    // Metrics
    const totalOrdersCount = orders.length;
    const reorderProbability = customer.reorderProbability || 0;
    const expectedDateStr = customer.expectedReorderDate
      ? new Date(customer.expectedReorderDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Not Scheduled';
    const lastOrderDateStr = orders.length > 0
      ? new Date(orders[0].orderDate || orders[0].createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'No orders placed';
    const repeatOrdersCount = totalOrdersCount > 1 ? totalOrdersCount - 1 : 0;
    const repeatOrderRate = totalOrdersCount > 0 ? `${Math.round((repeatOrdersCount / totalOrdersCount) * 100)}%` : '0%';

    // Initialize Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels CRM';
    workbook.lastModifiedBy = req.user.name || 'System User';
    workbook.created = new Date();
    workbook.modified = new Date();

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' } // Dark Slate Navy #0F172A
    };
    const headerFont = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    const sectionFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    const sectionFont = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' }
    };
    const labelFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' } // Slate 100
    };
    const labelFont = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FF334155' } // Slate 700
    };
    const dataFont = {
      name: 'Calibri',
      size: 10,
      color: { argb: 'FF0F172A' }
    };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    // ================= SHEET 1: Purchase Summary & Profile =================
    const summarySheet = workbook.addWorksheet('Purchase Summary', {
      views: [{ showGridLines: true }]
    });

    // Main Title Banner
    summarySheet.mergeCells('A1:F1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'JS LABELS — CUSTOMER PROFILE & PURCHASE REPORT';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = headerFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 32;

    summarySheet.mergeCells('A2:F2');
    const subTitleCell = summarySheet.getCell('A2');
    subTitleCell.value = `Generated on: ${new Date().toLocaleString('en-IN')} | Exported By: ${req.user.name || 'Admin'} (${req.user.role || 'Staff'})`;
    subTitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
    subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(2).height = 18;

    // Section 1: Customer Profile Details
    summarySheet.mergeCells('A4:F4');
    const sec1 = summarySheet.getCell('A4');
    sec1.value = '1. CUSTOMER PROFILE INFORMATION';
    sec1.font = sectionFont;
    sec1.fill = sectionFill;
    sec1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(4).height = 24;

    const profileRows = [
      ['Customer Name', customer.name || 'N/A', '', 'Company Name', customer.company || 'Individual Prospect', ''],
      ['Phone Number', customer.phone || 'N/A', '', 'Email Address', customer.email || 'N/A', ''],
      ['GST Number', customer.gstNo || 'N/A', '', 'Customer Type', customer.customerType || 'Regular', ''],
      ['Location / Address', customer.address || customer.city || 'N/A', '', 'Lead / Acq Source', customer.source || 'Website', ''],
      ['Sales Executive', customer.salesExecutive?.name || 'Unassigned', '', 'Customer Since', customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN') : 'N/A', '']
    ];

    profileRows.forEach((rowVals, idx) => {
      const rNum = 5 + idx;
      const row = summarySheet.getRow(rNum);
      row.values = [rowVals[0], rowVals[1], '', rowVals[3], rowVals[4], ''];
      summarySheet.mergeCells(`B${rNum}:C${rNum}`);
      summarySheet.mergeCells(`E${rNum}:F${rNum}`);

      ['A', 'D'].forEach(col => {
        const c = summarySheet.getCell(`${col}${rNum}`);
        c.fill = labelFill;
        c.font = labelFont;
        c.border = thinBorder;
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      ['B', 'E'].forEach(col => {
        const c = summarySheet.getCell(`${col}${rNum}`);
        c.font = dataFont;
        c.border = thinBorder;
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      row.height = 20;
    });

    // Section 2: Purchase & Reorder Analytics
    const rSec2 = 11;
    summarySheet.mergeCells(`A${rSec2}:F${rSec2}`);
    const sec2 = summarySheet.getCell(`A${rSec2}`);
    sec2.value = '2. PURCHASE & REORDER METRICS';
    sec2.font = sectionFont;
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }; // Teal/Emerald
    sec2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(rSec2).height = 24;

    const metricRows = [
      ['Total Orders Placed', totalOrdersCount, '', 'Reorder Probability', `${reorderProbability}%`, ''],
      ['Next Reorder Date', expectedDateStr, '', 'Last Order Date', lastOrderDateStr, ''],
      ['Repeat Orders Count', repeatOrdersCount, '', 'Repeat Order Rate', repeatOrderRate, '']
    ];

    metricRows.forEach((rowVals, idx) => {
      const rNum = rSec2 + 1 + idx;
      summarySheet.getRow(rNum).values = [rowVals[0], rowVals[1], '', rowVals[3], rowVals[4], ''];
      summarySheet.mergeCells(`B${rNum}:C${rNum}`);
      summarySheet.mergeCells(`E${rNum}:F${rNum}`);

      ['A', 'D'].forEach(col => {
        const c = summarySheet.getCell(`${col}${rNum}`);
        c.fill = labelFill;
        c.font = labelFont;
        c.border = thinBorder;
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      ['B', 'E'].forEach(col => {
        const c = summarySheet.getCell(`${col}${rNum}`);
        c.font = { ...dataFont, bold: true };
        c.border = thinBorder;
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      summarySheet.getRow(rNum).height = 20;
    });

    // Section 3: Order History Overview
    const rSec3 = 16;
    summarySheet.mergeCells(`A${rSec3}:F${rSec3}`);
    const sec3 = summarySheet.getCell(`A${rSec3}`);
    sec3.value = '3. ORDER HISTORY OVERVIEW';
    sec3.font = sectionFont;
    sec3.fill = sectionFill;
    sec3.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(rSec3).height = 24;

    const orderHeaders = ['Order No', 'Order Date', 'Status', 'Delivery Date', 'Delivery Address', 'Ordered Products / Jobs Summary'];
    const headerRow = summarySheet.getRow(rSec3 + 1);
    headerRow.values = orderHeaders;
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    if (orders.length === 0) {
      const emptyRow = summarySheet.getRow(rSec3 + 2);
      summarySheet.mergeCells(`A${rSec3 + 2}:F${rSec3 + 2}`);
      const emptyCell = summarySheet.getCell(`A${rSec3 + 2}`);
      emptyCell.value = 'No orders recorded for this customer account.';
      emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyRow.height = 22;
    } else {
      orders.forEach((ord, oIdx) => {
        const rNum = rSec3 + 2 + oIdx;
        const oRow = summarySheet.getRow(rNum);

        const orderDateStr = ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN') : 'N/A';
        const deliveryDateStr = ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-IN') : 'Pending';
        const itemsSummary = (ord.lineItems || []).map(li => {
          const p = li.productId;
          const name = p?.name || li.name || 'Product';
          const job = p?.jobName ? ` (${p.jobName})` : '';
          return `${name}${job} x ${li.qty || 1}`;
        }).join('; ') || 'No line items';

        oRow.values = [
          ord.orderNo || `ORD-${ord._id.toString().slice(-6).toUpperCase()}`,
          orderDateStr,
          (ord.status || 'confirmed').toUpperCase(),
          deliveryDateStr,
          ord.deliveryAddress || customer.address || 'Standard Delivery Address',
          itemsSummary
        ];

        const isZebra = oIdx % 2 === 1;
        oRow.eachCell((cell) => {
          cell.font = dataFont;
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          if (isZebra) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
        oRow.height = 20;
      });
    }

    // Set auto column widths for Sheet 1
    summarySheet.columns = [
      { key: 'A', width: 22 },
      { key: 'B', width: 24 },
      { key: 'C', width: 16 },
      { key: 'D', width: 20 },
      { key: 'E', width: 26 },
      { key: 'F', width: 45 }
    ];

    // ================= SHEET 2: Ordered Items & Specifications =================
    const itemsSheet = workbook.addWorksheet('Ordered Items & Specs', {
      views: [{ showGridLines: true }]
    });

    const itemColHeaders = [
      'Order No',
      'Order Date',
      'Order Status',
      'Product / Item Name',
      'Job Name',
      'Material',
      'Colour',
      'Dimensions (WxH mm)',
      'Quantity',
      'Expected Delivery'
    ];

    const itemHeaderRow = itemsSheet.getRow(1);
    itemHeaderRow.values = itemColHeaders;
    itemHeaderRow.height = 26;
    itemHeaderRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    let itemRowCounter = 2;
    orders.forEach((ord) => {
      const orderDateStr = ord.orderDate ? new Date(ord.orderDate).toLocaleDateString('en-IN') : 'N/A';
      const deliveryDateStr = ord.deliveryDate ? new Date(ord.deliveryDate).toLocaleDateString('en-IN') : 'Pending';

      (ord.lineItems || []).forEach((li) => {
        const p = li.productId || {};
        const row = itemsSheet.getRow(itemRowCounter);

        row.values = [
          ord.orderNo || `ORD-${ord._id.toString().slice(-6).toUpperCase()}`,
          orderDateStr,
          (ord.status || 'confirmed').toUpperCase(),
          p.name || li.name || 'Custom Product',
          p.jobName || 'Standard Job',
          p.material || 'Standard',
          p.colour || 'Standard',
          p.dimensionKey || (p.widthMm && p.heightMm ? `${p.widthMm}x${p.heightMm}` : 'Custom'),
          li.qty || 1,
          deliveryDateStr
        ];

        const isZebra = itemRowCounter % 2 === 1;
        row.eachCell((cell, colNum) => {
          cell.font = dataFont;
          cell.border = thinBorder;
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNum === 9 ? 'right' : 'left'
          };
          if (isZebra) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
        row.height = 20;
        itemRowCounter++;
      });
    });

    if (itemRowCounter === 2) {
      const emptyRow = itemsSheet.getRow(2);
      itemsSheet.mergeCells('A2:J2');
      const emptyCell = itemsSheet.getCell('A2');
      emptyCell.value = 'No individual order items recorded for this customer.';
      emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyRow.height = 22;
    }

    itemsSheet.columns = [
      { key: 'A', width: 16 },
      { key: 'B', width: 14 },
      { key: 'C', width: 15 },
      { key: 'D', width: 28 },
      { key: 'E', width: 20 },
      { key: 'F', width: 16 },
      { key: 'G', width: 14 },
      { key: 'H', width: 20 },
      { key: 'I', width: 12 },
      { key: 'J', width: 16 }
    ];

    // ================= SHEET 3: Activity & Follow-up Timeline =================
    if (activities.length > 0) {
      const activitySheet = workbook.addWorksheet('Activity & Notes Log', {
        views: [{ showGridLines: true }]
      });

      const actHeaders = ['Date & Time', 'Activity Type', 'Description / Interaction Details', 'Logged By'];
      const actHeaderRow = activitySheet.getRow(1);
      actHeaderRow.values = actHeaders;
      actHeaderRow.height = 26;
      actHeaderRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      activities.forEach((act, actIdx) => {
        const rNum = 2 + actIdx;
        const row = activitySheet.getRow(rNum);
        const dtStr = act.createdAt ? new Date(act.createdAt).toLocaleString('en-IN') : 'N/A';

        row.values = [
          dtStr,
          (act.type || 'activity').toUpperCase(),
          act.description || act.note || 'Recorded interaction',
          act.createdBy?.name || 'System'
        ];

        const isZebra = actIdx % 2 === 1;
        row.eachCell((cell) => {
          cell.font = dataFont;
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          if (isZebra) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
        row.height = 20;
      });

      activitySheet.columns = [
        { key: 'A', width: 22 },
        { key: 'B', width: 18 },
        { key: 'C', width: 50 },
        { key: 'D', width: 20 }
      ];
    }

    // Set Response Headers and Stream XLSX File
    const safeCustomerName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
    const todayIso = new Date().toISOString().split('T')[0];
    const filename = `Customer_Report_${safeCustomerName}_${todayIso}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting customer excel report:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error generating customer excel export' });
    }
  }
};

// DELETE /api/customers/:id
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await customer.softDelete(req.user.id);

    await Activity.create({
      relatedType: 'customer',
      relatedId: customer._id,
      type: 'status_change',
      description: `Customer ${customer.name} soft deleted`,
      createdBy: req.user.id
    });

    return res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    return res.status(500).json({ message: 'Server error deleting customer' });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  getCustomerById,
  getCustomerSummary,
  getCustomerOrders,
  getCustomerTimeline,
  updateCustomer,
  deleteCustomer,
  exportCustomerExcel
};
