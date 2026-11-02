const ExcelJS = require('exceljs');

/**
 * Normalizes text value from a cell, handling rich text or formula objects
 */
function getCleanCellString(cell) {
  if (cell == null) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'object') {
    if (cell.text) return String(cell.text).trim();
    if (cell.result) return String(cell.result).trim();
    if (Array.isArray(cell.richText)) {
      return cell.richText.map(t => t.text || '').join('').trim();
    }
  }
  return String(cell).trim();
}

/**
 * Parse products list from an ExcelJS workbook
 */
function parseProductsFromExcelWorkbook(workbook) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Dynamically find header row by scanning first 10 rows
  let headerRowNum = 1;
  let headerMap = {};

  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const candidateMap = {};

    row.eachCell((cell, colNumber) => {
      const text = getCleanCellString(cell.value).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!text || text.length > 50) return;

      // Skip banners/subtitles that mention export date or summary
      if (text.includes('exportedon') || text.includes('totalsupported')) return;

      if ((text.includes('product') || text.includes('friendlyname') || text === 'name') && !candidateMap.name) {
        candidateMap.name = colNumber;
      }
      if ((text.includes('width') || text === 'w') && !candidateMap.width) {
        candidateMap.width = colNumber;
      }
      if ((text.includes('height') || text.includes('length') || text === 'h') && !candidateMap.height) {
        candidateMap.height = colNumber;
      }
      if ((text.includes('unit') || text.includes('uom') || text.includes('sizeunit')) && !candidateMap.unit) {
        candidateMap.unit = colNumber;
      }
      if ((text.includes('job') || text.includes('jobname') || text.includes('customercode')) && !candidateMap.jobName) {
        candidateMap.jobName = colNumber;
      }
      if ((text.includes('category') || text === 'cat') && !candidateMap.category) {
        candidateMap.category = colNumber;
      }
      if ((text.includes('material') || text === 'mat') && !candidateMap.material) {
        candidateMap.material = colNumber;
      }
      if ((text.includes('colour') || text.includes('color')) && !candidateMap.colour) {
        candidateMap.colour = colNumber;
      }
      if (text.includes('status') && !candidateMap.status) {
        candidateMap.status = colNumber;
      }
      if ((text.includes('notes') || text.includes('remarks') || text.includes('checknotes')) && !candidateMap.notes) {
        candidateMap.notes = colNumber;
      }
      if ((text.includes('price') || text.includes('rate') || text.includes('unitprice')) && !candidateMap.price) {
        candidateMap.price = colNumber;
      }
      if ((text.includes('cycle') || text.includes('usagecycledays')) && !candidateMap.cycle) {
        candidateMap.cycle = colNumber;
      }
    });

    // Check if this row is a genuine header row (has distinct columns for product and width/material/job)
    const hasDistinctCols = candidateMap.name &&
      ((candidateMap.width && candidateMap.width !== candidateMap.name) ||
       (candidateMap.material && candidateMap.material !== candidateMap.name) ||
       (candidateMap.jobName && candidateMap.jobName !== candidateMap.name));

    if (hasDistinctCols) {
      headerRowNum = r;
      headerMap = candidateMap;
      break;
    }
  }

  // Fallback default column indices if headers were not recognized by name
  if (!headerMap.name) headerMap.name = 1;
  if (!headerMap.width) headerMap.width = 2;
  if (!headerMap.height) headerMap.height = 3;
  if (!headerMap.jobName) headerMap.jobName = 4;
  if (!headerMap.category) headerMap.category = 5;
  if (!headerMap.material) headerMap.material = 6;
  if (!headerMap.colour) headerMap.colour = 7;
  if (!headerMap.status) headerMap.status = 8;
  if (!headerMap.unit) headerMap.unit = 9;
  if (!headerMap.notes) headerMap.notes = 10;

  const parsedProducts = [];
  const errors = [];

  for (let rowNumber = headerRowNum + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row || !row.hasValues) continue;

    const rawName = getCleanCellString(row.getCell(headerMap.name).value);
    if (!rawName || rawName === '—' || rawName === '-' || rawName === '#') {
      // Row has no valid product name, skip
      continue;
    }

    const rawWidth = row.getCell(headerMap.width).value;
    const rawHeight = row.getCell(headerMap.height).value;
    const rawUnit = getCleanCellString(row.getCell(headerMap.unit).value).toUpperCase();
    const rawJobName = getCleanCellString(row.getCell(headerMap.jobName).value);
    const rawCategory = getCleanCellString(row.getCell(headerMap.category).value);
    const rawMaterial = getCleanCellString(row.getCell(headerMap.material).value);
    const rawColour = getCleanCellString(row.getCell(headerMap.colour).value);
    const rawStatus = getCleanCellString(row.getCell(headerMap.status).value).toLowerCase();
    const rawNotes = getCleanCellString(row.getCell(headerMap.notes).value);
    const rawPrice = headerMap.price ? row.getCell(headerMap.price).value : null;
    const rawCycle = headerMap.cycle ? row.getCell(headerMap.cycle).value : null;

    // Determine unit: MM or MTR
    let finalUnit = 'MM';
    const notesLower = rawNotes.toLowerCase();
    const nameLower = rawName.toLowerCase();
    if (
      rawUnit === 'MTR' ||
      rawUnit === 'M' ||
      rawUnit === 'METRE' ||
      rawUnit === 'METRES' ||
      rawUnit === 'METER' ||
      rawUnit === 'METERS' ||
      notesLower.includes('metres') ||
      notesLower.includes('roll/ribbon') ||
      notesLower.includes('mtr') ||
      nameLower.includes(' mtr') ||
      nameLower.includes('x300 mtr')
    ) {
      finalUnit = 'MTR';
    }

    // Parse dimensions
    let widthNum = (rawWidth !== null && rawWidth !== '' && rawWidth !== '—' && !isNaN(Number(rawWidth))) ? Number(rawWidth) : null;
    let heightNum = (rawHeight !== null && rawHeight !== '' && rawHeight !== '—' && !isNaN(Number(rawHeight))) ? Number(rawHeight) : null;

    // Fallback dimension recovery if missing
    if (widthNum == null || heightNum == null) {
      const combinedText = `${rawName} ${rawMaterial} ${rawNotes}`;
      const dimRegexMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX*]\s*(\d+(?:\.\d+)?)/i);
      if (dimRegexMatch) {
        if (widthNum == null) widthNum = parseFloat(dimRegexMatch[1]);
        if (heightNum == null) heightNum = parseFloat(dimRegexMatch[2]);
      } else if (
        widthNum != null &&
        (nameLower.includes('round') || rawMaterial.toLowerCase().includes('round') || notesLower.includes('single size') || notesLower.includes('dia'))
      ) {
        // Single size round label: diameter applies to both axes
        heightNum = widthNum;
      }
    }

    // Default to 0 if still absent (for services, non-dimensioned charges/products)
    widthNum = widthNum != null ? Math.max(0, widthNum) : 0;
    heightNum = heightNum != null ? Math.max(0, heightNum) : 0;

    // Parse status
    const status = (rawStatus === 'inactive' || rawStatus === 'disabled') ? 'inactive' : 'active';

    // Parse unit price
    const cleanPrice = getCleanCellString(rawPrice).replace(/[₹$, ]/g, '');
    const unitPrice = (cleanPrice !== '' && !isNaN(Number(cleanPrice))) ? Number(cleanPrice) : null;

    // Parse usage cycle
    const cleanCycle = getCleanCellString(rawCycle).replace(/\D/g, '');
    const defaultUsageCycleDays = (cleanCycle !== '' && !isNaN(Number(cleanCycle)) && Number(cleanCycle) > 0)
      ? Number(cleanCycle)
      : 30;

    parsedProducts.push({
      rowNumber,
      name: rawName,
      widthMm: widthNum,
      heightMm: heightNum,
      unit: finalUnit,
      jobName: rawJobName === '—' ? '' : rawJobName,
      category: (rawCategory && rawCategory !== '—') ? rawCategory : 'General',
      material: rawMaterial === '—' ? '' : rawMaterial,
      colour: rawColour === '—' ? '' : rawColour,
      status,
      unitPrice,
      defaultUsageCycleDays,
      notes: rawNotes
    });
  }

  return { parsedProducts, errors };
}

/**
 * Generate formatted Excel workbook containing product list
 */
function generateProductsExcelWorkbook(products, { title = 'JS LABELS — PRODUCTS CATALOG' } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JS Labels System';
  workbook.created = new Date();

  const titleFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
  const subFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };   // Slate 800
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };// Sapphire Navy
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  const titleFont = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const valueFont = { name: 'Segoe UI', size: 10, color: { argb: 'FF0F172A' } };

  const sheet = workbook.addWorksheet('Products Catalog', {
    views: [{ showGridLines: true }]
  });

  // Title Row
  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = titleFont;
  titleCell.fill = titleFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 32;

  // Subtitle Row
  sheet.mergeCells('A2:L2');
  const subCell = sheet.getCell('A2');
  const nowStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  subCell.value = `Exported On: ${nowStr}  |  Total Products: ${products.length}  |  Units Supported: MM & MTR`;
  subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  subCell.fill = subFill;
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 22;

  sheet.getRow(3).height = 8; // Spacing

  // Header Row
  const headers = [
    '#',
    'Product Friendly Name',
    'Width (mm)',
    'Height (mm)',
    'Size Unit',
    'Dimension Key',
    'Job Name',
    'Category',
    'Material',
    'Colour',
    'Status',
    'Check Notes'
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell, colIdx) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = thinBorder;
    cell.alignment = {
      vertical: 'middle',
      horizontal: [1, 3, 4, 5, 11].includes(colIdx) ? 'center' : 'left',
      indent: [1, 3, 4, 5, 11].includes(colIdx) ? 0 : 1
    };
  });

  // Data Rows
  products.forEach((p, index) => {
    const rowIdx = 5 + index;
    const row = sheet.getRow(rowIdx);
    const isZebra = index % 2 === 1;
    const rowBg = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

    const unit = (p.unit || 'MM').toUpperCase();
    const dimKey = p.dimensionKey || (p.widthMm && p.heightMm ? (unit === 'MTR' ? `${p.widthMm}x${p.heightMm} MTR` : `${p.widthMm}x${p.heightMm}`) : 'N/A');

    row.values = [
      index + 1,
      p.name || '—',
      p.widthMm != null ? p.widthMm : '—',
      p.heightMm != null ? p.heightMm : '—',
      unit,
      dimKey,
      p.jobName || '—',
      p.category || 'General',
      p.material || '—',
      p.colour || '—',
      (p.status || 'active').toUpperCase(),
      p.notes || ''
    ];

    row.height = 22;
    row.eachCell((cell, colIdx) => {
      cell.font = valueFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: [1, 3, 4, 5, 11].includes(colIdx) ? 'center' : 'left',
        indent: [1, 3, 4, 5, 11].includes(colIdx) ? 0 : 1
      };

      // Highlight unit column
      if (colIdx === 5) {
        if (unit === 'MTR') {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF2563EB' } }; // Blue for MTR
        } else {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } }; // Emerald for MM
        }
      }

      // Highlight status
      if (colIdx === 11) {
        const isAct = (p.status || 'active').toLowerCase() === 'active';
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: isAct ? 'FF059669' : 'FFDC2626' } };
      }
    });
  });

  sheet.columns = [
    { key: 'A', width: 7 },  // #
    { key: 'B', width: 34 }, // Name
    { key: 'C', width: 14 }, // Width
    { key: 'D', width: 14 }, // Height
    { key: 'E', width: 12 }, // Unit
    { key: 'F', width: 20 }, // Dimension Key
    { key: 'G', width: 18 }, // Job Name
    { key: 'H', width: 18 }, // Category
    { key: 'I', width: 28 }, // Material
    { key: 'J', width: 16 }, // Colour
    { key: 'K', width: 12 }, // Status
    { key: 'L', width: 36 }  // Notes
  ];

  return workbook;
}

module.exports = {
  getCleanCellString,
  parseProductsFromExcelWorkbook,
  generateProductsExcelWorkbook
};
