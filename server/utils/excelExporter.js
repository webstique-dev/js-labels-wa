const ExcelJS = require('exceljs');

/**
 * Reusable Professional Excel Exporter Helper using ExcelJS
 * @param {import('express').Response} res Express response object
 * @param {Object} config Report Configuration
 * @param {string} config.title Report Main Title Banner
 * @param {string} config.sheetName Worksheet Name
 * @param {Array<{name: string, key: string, width?: number, align?: 'left'|'center'|'right', isCurrency?: boolean, isDate?: boolean, isText?: boolean, isBadge?: boolean}>} config.headers Column Headers definition
 * @param {Array<Array<any>>} config.dataRows Matrix of data row values
 * @param {string} [config.period] Filter period description
 * @param {boolean} [config.isOrdersSummary] Whether to render SUM total summary row
 * @param {string} [config.filenamePrefix] File download name prefix
 */
const generateExcelReport = async (res, {
  title = 'JS LABELS EXECUTIVE REPORT',
  sheetName = 'Report Data',
  headers = [],
  dataRows = [],
  period = 'this_month',
  isOrdersSummary = false,
  filenamePrefix = 'report'
}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JS Labels WA System';
    workbook.lastModifiedBy = 'JS Labels Executive Engine';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    const nowStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const totalCols = headers.length || 1;

    const borderStyle = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } }
    };

    const statusBadgeFills = {
      delivered: { fill: 'DCFCE7', text: '15803D' },
      confirmed: { fill: 'DBEAFE', text: '1D4ED8' },
      dispatched: { fill: 'FEF3C7', text: 'B45309' },
      pending: { fill: 'F3E8FF', text: '6B21A8' },
      cancelled: { fill: 'FEE2E2', text: 'B91C1C' },
      won: { fill: 'DCFCE7', text: '15803D' },
      contacted: { fill: 'DBEAFE', text: '1D4ED8' },
      new: { fill: 'F3E8FF', text: '6B21A8' },
      lost: { fill: 'FEE2E2', text: 'B91C1C' },
      high: { fill: 'FEE2E2', text: 'B91C1C' },
      medium: { fill: 'FEF3C7', text: 'B45309' },
      low: { fill: 'DCFCE7', text: '15803D' }
    };

    // 1. Title Banner Row (Row 1)
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 32;

    // 2. Subtitle Metadata Row (Row 2)
    ws.mergeCells(2, 1, 2, totalCols);
    const subCell = ws.getCell('A2');
    subCell.value = `Generated On: ${nowStr}  |  Filter Period: ${String(period).replace('_', ' ').toUpperCase()}  |  Total Records: ${dataRows.length}`;
    subCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'CBD5E1' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(2).height = 22;

    // Spacing Rows (Row 3 & 4)
    ws.getRow(3).height = 8;
    ws.getRow(4).height = 8;

    // 3. Table Header Row (Row 5)
    const headerRow = ws.getRow(5);
    headerRow.height = 28;
    headers.forEach((h, colIdx) => {
      const cell = headerRow.getCell(colIdx + 1);
      cell.value = h.name;
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Sapphire Navy
      cell.alignment = { vertical: 'middle', horizontal: h.align || 'left' };
      cell.border = {
        top: { style: 'medium', color: { argb: '0F172A' } },
        bottom: { style: 'medium', color: { argb: '0F172A' } },
        left: { style: 'thin', color: { argb: '1E293B' } },
        right: { style: 'thin', color: { argb: '1E293B' } }
      };
    });

    // 4. Data Rows (Starting Row 6)
    dataRows.forEach((rowValues, rIdx) => {
      const rowNum = rIdx + 6;
      const row = ws.getRow(rowNum);
      row.height = 24;
      const isEven = rIdx % 2 === 0;
      const rowBgColor = isEven ? 'FFFFFF' : 'F8FAFC'; // Zebra striping

      rowValues.forEach((val, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        const colDef = headers[cIdx] || {};

        cell.font = { name: 'Segoe UI', size: 10, color: { argb: '1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: colDef.align || 'left' };

        if (colDef.isCurrency && typeof val === 'number') {
          cell.value = val;
          cell.numFmt = '"₹ "#,##0';
          cell.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: '0F172A' } };
        } else if (colDef.isDate && (val instanceof Date || (typeof val === 'string' && !isNaN(new Date(val).getTime())))) {
          cell.value = val instanceof Date ? val : new Date(val);
          cell.numFmt = 'DD-MMM-YYYY';
        } else if (colDef.isText) {
          cell.value = val !== undefined && val !== null ? String(val) : '—';
          cell.numFmt = '@'; // Force text format for phone numbers
        } else if (colDef.isBadge && typeof val === 'string') {
          const sKey = val.toLowerCase().trim();
          const bStyle = statusBadgeFills[sKey] || { fill: 'F1F5F9', text: '475569' };
          cell.value = val.toUpperCase();
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bStyle.fill } };
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: bStyle.text } };
        } else {
          cell.value = val !== undefined && val !== null ? val : '—';
        }
      });
    });

    // 5. Total Summary Row for Orders
    if (isOrdersSummary && dataRows.length > 0) {
      const summaryRowNum = dataRows.length + 6;
      const sumRow = ws.getRow(summaryRowNum);
      sumRow.height = 28;

      for (let i = 1; i <= totalCols; i++) {
        const cell = sumRow.getCell(i);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
        cell.border = {
          top: { style: 'thin', color: { argb: '0F172A' } },
          bottom: { style: 'double', color: { argb: '0F172A' } }
        };

        if (i === 5) {
          cell.value = 'TOTAL REVENUE:';
          cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: '0F172A' } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (i === 6) {
          cell.value = { formula: `SUM(F6:F${summaryRowNum - 1})` };
          cell.numFmt = '"₹ "#,##0';
          cell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: '047857' } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      }
    }

    // 6. Table AutoFilter
    ws.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: totalCols }
    };

    // 7. Auto Column Widths
    headers.forEach((colDef, idx) => {
      const col = ws.getColumn(idx + 1);
      let maxLen = (colDef.name || '').length;
      dataRows.forEach(r => {
        const cellVal = r[idx];
        if (cellVal) {
          const str = cellVal instanceof Date ? '12-MAY-2025' : String(cellVal);
          if (str.length > maxLen) maxLen = str.length;
        }
      });
      col.width = Math.max(colDef.width || 15, maxLen + 5);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filenamePrefix}_report_${Date.now()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel report:', err);
    res.status(500).json({ message: 'Error generating Excel report' });
  }
};

module.exports = { generateExcelReport };
