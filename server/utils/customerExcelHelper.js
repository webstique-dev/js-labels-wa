const ExcelJS = require('exceljs');

function cleanStr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim().replace(/\s+/g, ' ');
  if (typeof v === 'number') return String(v).trim();
  if (typeof v === 'object') {
    if (v.text) return String(v.text).trim().replace(/\s+/g, ' ');
    if (v.result) return String(v.result).trim().replace(/\s+/g, ' ');
    if (Array.isArray(v.richText)) {
      return v.richText.map(t => t.text || '').join('').trim().replace(/\s+/g, ' ');
    }
  }
  return String(v).trim();
}

function splitPhones(str) {
  if (!str) return [];
  return str.split(/[/,;\n]+/).map(s => s.trim()).filter(Boolean);
}

/**
 * Parses and aggregates customer details from the invoice billing details workbook
 */
function parseCustomersFromInvoiceWorkbook(workbook) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Find header row and map column indices
  let headerRowNum = 1;
  const headerMap = {};

  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const candidateMap = {};

    row.eachCell((cell, colNumber) => {
      const text = cleanStr(cell.value).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!text) return;

      if (text.includes('customername') || text === 'displayname' || text === 'customer' || text.includes('contactname') || (text.includes('client') && !candidateMap.customerName)) {
        if (!candidateMap.customerName) candidateMap.customerName = colNumber;
      }
      if (text.includes('companyname') || text === 'company') {
        candidateMap.company = colNumber;
      }
      if (text.includes('contactmobile') || text.includes('mobilephone') || text === 'mobile') {
        candidateMap.primaryMobile = colNumber;
      }
      if (text.includes('contactemail') || text.includes('emailid') || text === 'email') {
        candidateMap.email = colNumber;
      }
      if (text.includes('contactphone') || (text.includes('phone') && !text.includes('mobile') && !text.includes('billing') && !text.includes('shipping'))) {
        candidateMap.contactPhone = colNumber;
      }
      if (text.includes('gstin') || text.includes('gstidentification') || text === 'gst' || text === 'gstno') {
        candidateMap.gstNo = colNumber;
      }
      if (text.includes('attention') || text.includes('contactperson')) {
        if (!candidateMap.attention || text.includes('billing')) candidateMap.attention = colNumber;
      }
      if (text.includes('billingstreet2') || text.includes('street2') || text.includes('address2')) {
        if (!candidateMap.street2 || text.includes('billing')) candidateMap.street2 = colNumber;
      } else if (text.includes('billingaddress') || text === 'address') {
        if (!candidateMap.address || text.includes('billing')) candidateMap.address = colNumber;
      }
      if (text.includes('city') && !text.includes('shipping')) {
        if (!candidateMap.city || text.includes('billing')) candidateMap.city = colNumber;
      }
      if (text.includes('state') && !text.includes('shipping')) {
        if (!candidateMap.state || text.includes('billing')) candidateMap.state = colNumber;
      }
      if (text.includes('country') && !text.includes('shipping')) {
        if (!candidateMap.country || text.includes('billing')) candidateMap.country = colNumber;
      }
      if ((text.includes('code') || text.includes('pin') || text.includes('zip')) && !text.includes('shipping') && !text.includes('currency') && !text.includes('statecode')) {
        if (!candidateMap.code || text.includes('billing')) candidateMap.code = colNumber;
      }
      if (text.includes('billingphone')) {
        candidateMap.billingPhone = colNumber;
      }
      if (text.includes('paymentterms')) {
        candidateMap.paymentTerms = colNumber;
      }
      if (text.includes('creditlimit')) {
        candidateMap.creditLimit = colNumber;
      }
    });

    if (candidateMap.customerName) {
      headerRowNum = r;
      Object.assign(headerMap, candidateMap);
      break;
    }
  }

  // Fallback defaults matching Invoice_Customer_Billing_Details.xlsx
  if (!headerMap.customerName) headerMap.customerName = 1;
  if (!headerMap.primaryMobile) headerMap.primaryMobile = 4;
  if (!headerMap.email) headerMap.email = 5;
  if (!headerMap.contactPhone) headerMap.contactPhone = 6;
  if (!headerMap.attention) headerMap.attention = 7;
  if (!headerMap.address) headerMap.address = 8;
  if (!headerMap.street2) headerMap.street2 = 9;
  if (!headerMap.city) headerMap.city = 10;
  if (!headerMap.state) headerMap.state = 11;
  if (!headerMap.country) headerMap.country = 12;
  if (!headerMap.code) headerMap.code = 13;
  if (!headerMap.billingPhone) headerMap.billingPhone = 14;

  const customersMap = new Map();
  const errors = [];

  for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || !row.hasValues) continue;

    const rawName = cleanStr(row.getCell(headerMap.customerName).value);
    if (!rawName || rawName === '—' || rawName === '-') continue;

    const key = rawName.toLowerCase();
    if (!customersMap.has(key)) {
      customersMap.set(key, {
        name: rawName,
        company: headerMap.company ? cleanStr(row.getCell(headerMap.company).value) : rawName,
        allMobiles: [],
        email: '',
        contactPhone: '',
        gstNo: '',
        creditLimit: 0,
        paymentTerms: '',
        billingAttention: '',
        billingAddress: '',
        billingStreet2: '',
        city: '',
        state: '',
        country: '',
        pincode: '',
        billingPhone: ''
      });
    }

    const rec = customersMap.get(key);

    if (headerMap.company) {
      const compVal = cleanStr(row.getCell(headerMap.company).value);
      if (compVal && (!rec.company || rec.company === rec.name)) rec.company = compVal;
    }

    if (headerMap.gstNo) {
      const gstVal = cleanStr(row.getCell(headerMap.gstNo).value);
      if (gstVal && !rec.gstNo) rec.gstNo = gstVal;
    }

    if (headerMap.paymentTerms) {
      const ptVal = cleanStr(row.getCell(headerMap.paymentTerms).value);
      if (ptVal && !rec.paymentTerms) rec.paymentTerms = ptVal;
    }

    if (headerMap.creditLimit) {
      const clVal = cleanStr(row.getCell(headerMap.creditLimit).value).replace(/[^\d.]/g, '');
      const clNum = parseFloat(clVal);
      if (!isNaN(clNum) && clNum > 0 && !rec.creditLimit) rec.creditLimit = clNum;
    }

    if (headerMap.primaryMobile) {
      const mobileVal = cleanStr(row.getCell(headerMap.primaryMobile).value);
      if (mobileVal) {
        splitPhones(mobileVal).forEach(p => {
          if (!rec.allMobiles.includes(p)) rec.allMobiles.push(p);
        });
      }
    }

    if (headerMap.email) {
      const emailVal = cleanStr(row.getCell(headerMap.email).value);
      if (emailVal && !rec.email) rec.email = emailVal;
    }

    if (headerMap.contactPhone) {
      const contactPhoneVal = cleanStr(row.getCell(headerMap.contactPhone).value);
      if (contactPhoneVal && !rec.contactPhone) rec.contactPhone = contactPhoneVal;
    }

    if (headerMap.attention) {
      const attentionVal = cleanStr(row.getCell(headerMap.attention).value);
      if (attentionVal && !rec.billingAttention) rec.billingAttention = attentionVal;
    }

    if (headerMap.address) {
      const addrVal = cleanStr(row.getCell(headerMap.address).value);
      if (addrVal && !rec.billingAddress) rec.billingAddress = addrVal;
    }

    if (headerMap.street2) {
      const street2Val = cleanStr(row.getCell(headerMap.street2).value);
      if (street2Val && !rec.billingStreet2) rec.billingStreet2 = street2Val;
    }

    if (headerMap.city) {
      const cityVal = cleanStr(row.getCell(headerMap.city).value);
      if (cityVal && !rec.city) rec.city = cityVal;
    }

    if (headerMap.state) {
      const stateVal = cleanStr(row.getCell(headerMap.state).value);
      if (stateVal && !rec.state) rec.state = stateVal;
    }

    if (headerMap.country) {
      const countryVal = cleanStr(row.getCell(headerMap.country).value);
      if (countryVal && !rec.country) rec.country = countryVal;
    }

    if (headerMap.code) {
      const codeVal = cleanStr(row.getCell(headerMap.code).value);
      if (codeVal && !rec.pincode) rec.pincode = codeVal;
    }

    if (headerMap.billingPhone) {
      const billingPhoneVal = cleanStr(row.getCell(headerMap.billingPhone).value);
      if (billingPhoneVal && !rec.billingPhone) rec.billingPhone = billingPhoneVal;
    }
  }

  const parsedCustomers = [];

  customersMap.forEach(c => {
    // 1. Primary phone number as main contact number
    let primaryPhone = c.allMobiles[0] || c.billingPhone || c.contactPhone || '';

    // 2. Secondary phone numbers:
    // "Use primary contact phone number as secondary contact number" + other phone numbers as phone number 2
    const otherMobiles = c.allMobiles.slice(1);
    const secondaryList = [];

    if (c.contactPhone && c.contactPhone !== primaryPhone) {
      secondaryList.push(c.contactPhone);
    }
    otherMobiles.forEach(m => {
      if (!secondaryList.includes(m) && m !== primaryPhone) {
        secondaryList.push(m);
      }
    });
    if (c.billingPhone && c.billingPhone !== primaryPhone && !secondaryList.includes(c.billingPhone)) {
      secondaryList.push(c.billingPhone);
    }

    const phone2 = secondaryList.join(', ');

    // 3. Billing details populate address information
    const streetParts = [c.billingAddress, c.billingStreet2].filter(Boolean);
    const fullStreet = streetParts.join(', ');

    parsedCustomers.push({
      name: c.name,
      company: c.company || c.name,
      phone: primaryPhone,
      phone2,
      email: c.email ? c.email.toLowerCase() : '',
      gstNo: c.gstNo,
      address: fullStreet,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      country: c.country || 'India',
      billingAttention: c.billingAttention,
      billingPhone: c.billingPhone,
      paymentTerms: c.paymentTerms || '30 Days',
      creditLimit: c.creditLimit || 100000
    });
  });

  return { parsedCustomers, errors };
}

/**
 * Generate formatted Excel workbook containing customers billing directory
 */
function generateCustomersExcelWorkbook(customers, { title = 'JS LABELS — CUSTOMER DIRECTORY & BILLING DETAILS' } = {}) {
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

  const sheet = workbook.addWorksheet('Customers', {
    views: [{ showGridLines: true }]
  });

  // Row 1: Title Banner
  sheet.mergeCells('A1:O1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = titleFont;
  titleCell.fill = titleFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 32;

  // Row 2: Subtitle / Metadata Banner
  sheet.mergeCells('A2:O2');
  const subCell = sheet.getCell('A2');
  const nowStr = new Date().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  subCell.value = `Total Customer Accounts: ${customers.length}  |  Generated On: ${nowStr}  |  JS Labels CRM`;
  subCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  subCell.fill = subFill;
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 20;

  // Row 3: Blank separator
  sheet.getRow(3).height = 8;

  // Row 4: Column Headers
  const headers = [
    '#',
    'Customer Name',
    'Company',
    'Primary Contact Phone',
    'Phone 2 / Secondary Contact',
    'Email Address',
    'Billing Attention',
    'Billing Address',
    'City',
    'State',
    'Postal Code',
    'Country',
    'Billing Phone',
    'Customer Type',
    'Payment Terms'
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
      horizontal: colIdx === 1 ? 'center' : 'left',
      indent: colIdx === 1 ? 0 : 1
    };
  });

  // Data Rows
  customers.forEach((c, idx) => {
    const rowNum = 5 + idx;
    const r = sheet.getRow(rowNum);
    const isZebra = idx % 2 === 1;
    const rowBg = isZebra ? 'FFF8FAFC' : 'FFFFFFFF';

    r.values = [
      idx + 1,
      c.name || '—',
      c.company || c.name || '—',
      c.phone || '—',
      c.phone2 || '—',
      c.email || '—',
      c.billingAttention || '—',
      c.address || '—',
      c.city || '—',
      c.state || '—',
      c.pincode || '—',
      c.country || 'India',
      c.billingPhone || '—',
      c.customerType || 'Regular',
      c.paymentTerms || '30 Days'
    ];
    r.height = 22;

    r.eachCell((cell, colIdx) => {
      cell.font = valueFont;
      cell.border = thinBorder;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colIdx === 1 ? 'center' : 'left',
        indent: colIdx === 1 ? 0 : 1
      };
    });
  });

  sheet.columns = [
    { key: 'A', width: 6 },
    { key: 'B', width: 28 },
    { key: 'C', width: 28 },
    { key: 'D', width: 20 },
    { key: 'E', width: 26 },
    { key: 'F', width: 26 },
    { key: 'G', width: 22 },
    { key: 'H', width: 34 },
    { key: 'I', width: 16 },
    { key: 'J', width: 16 },
    { key: 'K', width: 14 },
    { key: 'L', width: 14 },
    { key: 'M', width: 18 },
    { key: 'N', width: 16 },
    { key: 'O', width: 16 }
  ];

  return workbook;
}

module.exports = {
  cleanStr,
  splitPhones,
  parseCustomersFromInvoiceWorkbook,
  generateCustomersExcelWorkbook
};
