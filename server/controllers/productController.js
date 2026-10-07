const Product = require('../models/Product');
const ExcelJS = require('exceljs');

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const { category, status, search, page, limit } = req.query;

    const query = {};

    // Filter by status
    if (status && status.trim()) {
      query.status = status.trim();
    }

    // Filter by category
    if (category && category.trim()) {
      query.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    // Search by name or dimension
    if (search && search.trim()) {
      const searchTrimmed = search.trim();
      const searchRegex = new RegExp(searchTrimmed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
      
      // Also handle variations like "4 x 45" or "4x45"
      const normalizedDim = searchTrimmed.replace(/\s*x\s*/i, 'x');
      const dimRegex = new RegExp(normalizedDim.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');

      const orConditions = [
        { name: searchRegex },
        { dimensionKey: dimRegex },
        { dimensionKey: searchRegex },
        { category: searchRegex }
      ];

      // If search is numeric (e.g. searching "45"), also match widthMm or heightMm
      const numVal = parseFloat(searchTrimmed);
      if (!isNaN(numVal)) {
        orConditions.push({ widthMm: numVal });
        orConditions.push({ heightMm: numVal });
      }

      query.$or = orConditions;
    }

    const sortOption = { name: 1, createdAt: -1 };

    // Support pagination if requested or default
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = limit !== undefined ? parseInt(limit, 10) : 50;

    if (limitNum > 0) {
      const skip = (pageNum - 1) * limitNum;
      const [products, total] = await Promise.all([
        Product.find(query).sort(sortOption).skip(skip).limit(limitNum),
        Product.countDocuments(query)
      ]);

      return res.json({
        products,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1
      });
    }

    // Unpaginated fallback if limit is 0
    const products = await Product.find(query).sort(sortOption);
    return res.json({
      products,
      total: products.length,
      page: 1,
      pages: 1
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ message: 'Server error fetching products' });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json(product);
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return res.status(500).json({ message: 'Server error fetching product' });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  try {
    const {
      name,
      widthMm,
      heightMm,
      jobName,
      material,
      colour,
      color,
      category,
      defaultUsageCycleDays,
      unitPrice,
      status
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Product name is required' });
    }

    if (widthMm == null || isNaN(Number(widthMm)) || Number(widthMm) <= 0) {
      return res.status(400).json({ message: 'Valid width in mm is required' });
    }

    if (heightMm == null || isNaN(Number(heightMm)) || Number(heightMm) <= 0) {
      return res.status(400).json({ message: 'Valid height in mm is required' });
    }

    const finalJobName = (jobName || '').trim();
    if (!finalJobName) {
      return res.status(400).json({ message: 'Job Name is required' });
    }

    const finalMaterial = (material || '').trim();
    if (!finalMaterial) {
      return res.status(400).json({ message: 'Material is required' });
    }

    const finalColour = (colour || color || '').trim();
    if (!finalColour) {
      return res.status(400).json({ message: 'Colour is required' });
    }

    const parsedWidth = Number(widthMm);
    const parsedHeight = Number(heightMm);
    const parsedUnitPrice = (unitPrice !== '' && unitPrice !== null && unitPrice !== undefined)
      ? Number(unitPrice)
      : null;

    const parsedCycleDays = Number(defaultUsageCycleDays);
    const parsedUsageCycle = (!isNaN(parsedCycleDays) && parsedCycleDays > 0)
      ? parsedCycleDays
      : 30;

    const product = new Product({
      name: name.trim(),
      widthMm: parsedWidth,
      heightMm: parsedHeight,
      dimensionKey: `${parsedWidth}x${parsedHeight}`,
      jobName: finalJobName,
      material: finalMaterial,
      colour: finalColour,
      category: category ? category.trim() : undefined,
      defaultUsageCycleDays: parsedUsageCycle,
      unitPrice: isNaN(parsedUnitPrice) ? null : parsedUnitPrice,
      status: ['active', 'inactive'].includes(status) ? status : 'active'
    });

    await product.save();

    return res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Server error creating product' });
  }
};

// PATCH /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      widthMm,
      heightMm,
      jobName,
      material,
      colour,
      color,
      category,
      defaultUsageCycleDays,
      unitPrice,
      status
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Product name cannot be empty' });
      }
      product.name = name.trim();
    }

    if (widthMm !== undefined) {
      if (isNaN(Number(widthMm)) || Number(widthMm) <= 0) {
        return res.status(400).json({ message: 'Width must be a positive number' });
      }
      product.widthMm = Number(widthMm);
    }

    if (heightMm !== undefined) {
      if (isNaN(Number(heightMm)) || Number(heightMm) <= 0) {
        return res.status(400).json({ message: 'Height must be a positive number' });
      }
      product.heightMm = Number(heightMm);
    }

    // Recalculate dimensionKey
    product.dimensionKey = `${product.widthMm}x${product.heightMm}`;

    if (jobName !== undefined) {
      product.jobName = jobName ? jobName.trim() : '';
    }

    if (material !== undefined) {
      product.material = material ? material.trim() : '';
    }

    if (colour !== undefined || color !== undefined) {
      const c = colour !== undefined ? colour : color;
      product.colour = c ? c.trim() : '';
    }

    if (category !== undefined) {
      product.category = category ? category.trim() : undefined;
    }

    if (defaultUsageCycleDays !== undefined) {
      const parsedCycleDays = Number(defaultUsageCycleDays);
      if (!isNaN(parsedCycleDays) && parsedCycleDays > 0) {
        product.defaultUsageCycleDays = parsedCycleDays;
      }
    }

    if (unitPrice !== undefined) {
      if (unitPrice === '' || unitPrice === null) {
        product.unitPrice = null;
      } else {
        const parsedPrice = Number(unitPrice);
        product.unitPrice = isNaN(parsedPrice) ? null : parsedPrice;
      }
    }

    if (status !== undefined && ['active', 'inactive'].includes(status)) {
      product.status = status;
    }

    await product.save();

    return res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'Server error updating product' });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await product.softDelete(req.user.id);
    return res.json({ message: 'Product moved to trash successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Server error deleting product' });
  }
};

// POST /api/products/:id/job-times
const addJobTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, timeSpent, notes } = req.body;

    if (!date || !date.trim()) {
      return res.status(400).json({ message: 'Date is required' });
    }

    if (!timeSpent || !timeSpent.trim()) {
      return res.status(400).json({ message: 'Job Time is required (e.g. "1 hour", "1 hr 30 min")' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!Array.isArray(product.jobTimes)) {
      product.jobTimes = [];
    }

    product.jobTimes.push({
      date: date.trim(),
      timeSpent: timeSpent.trim(),
      notes: (notes || '').trim(),
      recordedBy: req.user?._id || req.user?.id
    });

    // Sort job times descending by date
    product.jobTimes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    await product.save();

    return res.status(201).json({
      message: 'Job time entry added successfully',
      jobTimes: product.jobTimes,
      product
    });
  } catch (error) {
    console.error('Error adding job time entry:', error);
    return res.status(500).json({ message: 'Server error adding job time' });
  }
};

// PATCH /api/products/:id/job-times/:timeId
const updateJobTime = async (req, res) => {
  try {
    const { id, timeId } = req.params;
    const { date, timeSpent, notes } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const entry = product.jobTimes.id(timeId);
    if (!entry) {
      return res.status(404).json({ message: 'Job time entry not found' });
    }

    if (date !== undefined) {
      if (!date.trim()) return res.status(400).json({ message: 'Date cannot be empty' });
      entry.date = date.trim();
    }

    if (timeSpent !== undefined) {
      if (!timeSpent.trim()) return res.status(400).json({ message: 'Job time cannot be empty' });
      entry.timeSpent = timeSpent.trim();
    }

    if (notes !== undefined) {
      entry.notes = notes.trim();
    }

    // Re-sort job times descending by date
    product.jobTimes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    await product.save();

    return res.json({
      message: 'Job time entry updated successfully',
      jobTimes: product.jobTimes,
      product
    });
  } catch (error) {
    console.error('Error updating job time entry:', error);
    return res.status(500).json({ message: 'Server error updating job time' });
  }
};

// DELETE /api/products/:id/job-times/:timeId
const deleteJobTime = async (req, res) => {
  try {
    const { id, timeId } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const entry = product.jobTimes.id(timeId);
    if (!entry) {
      return res.status(404).json({ message: 'Job time entry not found' });
    }

    product.jobTimes.pull(timeId);
    await product.save();

    return res.json({
      message: 'Job time entry deleted successfully',
      jobTimes: product.jobTimes,
      product
    });
  } catch (error) {
    console.error('Error deleting job time entry:', error);
    return res.status(500).json({ message: 'Server error deleting job time' });
  }
};

// GET /api/products/:id/export-excel
const exportProductExcel = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels System';
    workbook.created = new Date();

    const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
    const sectionFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Sapphire Navy
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    const titleFont = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const labelFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF334155' } };
    const valueFont = { name: 'Segoe UI', size: 10, color: { argb: 'FF0F172A' } };

    // ================= SHEET 1: Product Specifications & Time History =================
    const specSheet = workbook.addWorksheet('Product Details & History', {
      views: [{ showGridLines: true }]
    });

    // 1. Title Banner
    specSheet.mergeCells('A1:D1');
    const titleCell = specSheet.getCell('A1');
    titleCell.value = 'JS LABELS — PRODUCT SPECIFICATIONS & JOB TIME REPORT';
    titleCell.font = titleFont;
    titleCell.fill = titleFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    specSheet.getRow(1).height = 30;

    // Subtitle
    specSheet.mergeCells('A2:D2');
    const subCell = specSheet.getCell('A2');
    const nowStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    subCell.value = `Exported On: ${nowStr}  |  Product: ${product.name}  |  ID: ${product._id}`;
    subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
    subCell.fill = sectionFill;
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    specSheet.getRow(2).height = 20;

    specSheet.getRow(3).height = 10;

    // Spec Key-Value Pairs
    const sortedTimes = [...(product.jobTimes || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latestTime = sortedTimes.length > 0 ? sortedTimes[0] : null;

    const specs = [
      ['Product Friendly Name', product.name || '—', 'Dimension Key', product.dimensionKey || `${product.widthMm}x${product.heightMm}`],
      ['Width (mm)', `${product.widthMm} mm`, 'Height (mm)', `${product.heightMm} mm`],
      ['Job Name', product.jobName || '—', 'Category', product.category || 'General'],
      ['Material', product.material || '—', 'Colour', product.colour || '—'],
      ['Default Usage Cycle', `${product.defaultUsageCycleDays || 30} Days`, 'Status', (product.status || 'active').toUpperCase()],
      ['Total Job Time Records', `${sortedTimes.length} Logged`, 'Latest Job Time', latestTime ? `${latestTime.timeSpent} (on ${latestTime.date})` : 'None Logged'],
      ['Created At', product.createdAt ? new Date(product.createdAt).toLocaleString('en-IN') : '—', 'Last Updated', product.updatedAt ? new Date(product.updatedAt).toLocaleString('en-IN') : '—']
    ];

    let rowNum = 4;
    specs.forEach((s) => {
      const row = specSheet.getRow(rowNum);
      row.values = [s[0], s[1], s[2], s[3]];
      row.height = 24;

      ['A', 'C'].forEach((col) => {
        const cell = row.getCell(col);
        cell.font = labelFont;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });

      ['B', 'D'].forEach((col) => {
        const cell = row.getCell(col);
        cell.font = valueFont;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });

      rowNum++;
    });

    // Space before Job Time History Section
    specSheet.getRow(rowNum).height = 14;
    rowNum++;

    // Section 2 Header Banner on Main Sheet
    specSheet.mergeCells(`A${rowNum}:D${rowNum}`);
    const timeSecHeader = specSheet.getCell(`A${rowNum}`);
    timeSecHeader.value = `ALL LOGGED JOB TIME RECORDS (${sortedTimes.length} TOTAL)`;
    timeSecHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    timeSecHeader.fill = headerFill;
    timeSecHeader.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    specSheet.getRow(rowNum).height = 26;
    rowNum++;

    // Table Column Headers on Main Sheet
    const tableHeaders = ['#', 'Date of Job', 'Job Completion Time', 'Notes & Operator Remarks'];
    const tableHeaderRow = specSheet.getRow(rowNum);
    tableHeaderRow.values = tableHeaders;
    tableHeaderRow.height = 24;
    tableHeaderRow.eachCell((cell, colIdx) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colIdx === 1 ? 'center' : 'left',
        indent: colIdx === 1 ? 0 : 1
      };
    });
    rowNum++;

    // Render all logged time entries directly on main sheet
    if (sortedTimes.length === 0) {
      specSheet.mergeCells(`A${rowNum}:D${rowNum}`);
      const emptyCell = specSheet.getCell(`A${rowNum}`);
      emptyCell.value = 'No job time history entries have been logged for this product yet.';
      emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      specSheet.getRow(rowNum).height = 26;
      rowNum++;
    } else {
      sortedTimes.forEach((entry, idx) => {
        const r = specSheet.getRow(rowNum);
        const isZebra = idx % 2 === 1;
        const rowBgColor = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

        r.values = [
          idx + 1,
          entry.date || '—',
          entry.timeSpent || '—',
          entry.notes || '—'
        ];
        r.height = 22;

        r.eachCell((cell, colIdx) => {
          cell.font = valueFont;
          cell.border = thinBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colIdx === 1 ? 'center' : 'left',
            indent: colIdx === 1 ? 0 : 1
          };
          if (colIdx === 3) {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB91C1C' } }; // Highlight duration
          }
        });

        rowNum++;
      });
    }

    specSheet.columns = [
      { key: 'A', width: 22 },
      { key: 'B', width: 30 },
      { key: 'C', width: 26 },
      { key: 'D', width: 45 }
    ];

    // ================= SHEET 2: Dedicated Full Job Time Log =================
    const timeSheet = workbook.addWorksheet('Job Time Log', {
      views: [{ showGridLines: true }]
    });

    // 1. Time Sheet Header
    timeSheet.mergeCells('A1:E1');
    const timeTitleCell = timeSheet.getCell('A1');
    timeTitleCell.value = `COMPLETE JOB TIME LOG — ${product.name}`;
    timeTitleCell.font = titleFont;
    timeTitleCell.fill = titleFill;
    timeTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    timeSheet.getRow(1).height = 30;

    timeSheet.mergeCells('A2:E2');
    const timeSubCell = timeSheet.getCell('A2');
    timeSubCell.value = `Total Recorded Entries: ${sortedTimes.length}  |  Dimension: ${product.widthMm}x${product.heightMm} mm  |  Material: ${product.material || 'Standard'}`;
    timeSubCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
    timeSubCell.fill = sectionFill;
    timeSubCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    timeSheet.getRow(2).height = 20;

    timeSheet.getRow(3).height = 8;

    // 2. Table Column Headers
    const headers = ['#', 'Date of Job', 'Job Completion Time', 'Notes & Remarks', 'Recorded Timestamp'];
    const timeHeaderRow = timeSheet.getRow(4);
    timeHeaderRow.values = headers;
    timeHeaderRow.height = 26;
    timeHeaderRow.eachCell((cell, colIdx) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colIdx === 1 ? 'center' : 'left',
        indent: colIdx === 1 ? 0 : 1
      };
    });

    // 3. Rows
    if (sortedTimes.length === 0) {
      const emptyRow = timeSheet.getRow(5);
      timeSheet.mergeCells('A5:E5');
      const emptyCell = timeSheet.getCell('A5');
      emptyCell.value = 'No job time history entries have been logged for this product yet.';
      emptyCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
      emptyRow.height = 28;
    } else {
      sortedTimes.forEach((entry, idx) => {
        const r = timeSheet.getRow(5 + idx);
        const isZebra = idx % 2 === 1;
        const rowBgColor = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

        r.values = [
          idx + 1,
          entry.date || '—',
          entry.timeSpent || '—',
          entry.notes || '—',
          entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN') : '—'
        ];
        r.height = 22;

        r.eachCell((cell, colIdx) => {
          cell.font = valueFont;
          cell.border = thinBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colIdx === 1 ? 'center' : 'left',
            indent: colIdx === 1 ? 0 : 1
          };
          if (colIdx === 3) {
            cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
          }
        });
      });
    }

    timeSheet.columns = [
      { key: 'A', width: 8 },
      { key: 'B', width: 18 },
      { key: 'C', width: 24 },
      { key: 'D', width: 45 },
      { key: 'E', width: 26 }
    ];

    // Filename: ProductName_ProductDetails.xlsx
    const safeName = (product.name || 'Product').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeName}_ProductDetails.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting product to excel:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error generating product excel export' });
    }
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addJobTime,
  updateJobTime,
  deleteJobTime,
  exportProductExcel
};
