const Product = require('../models/Product');

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

    const parsedWidth = Number(widthMm);
    const parsedHeight = Number(heightMm);
    const parsedUnitPrice = (unitPrice !== '' && unitPrice !== null && unitPrice !== undefined)
      ? Number(unitPrice)
      : null;

    const parsedUsageCycle = [30, 45].includes(Number(defaultUsageCycleDays))
      ? Number(defaultUsageCycleDays)
      : 30;

    const product = new Product({
      name: name.trim(),
      widthMm: parsedWidth,
      heightMm: parsedHeight,
      dimensionKey: `${parsedWidth}x${parsedHeight}`,
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

    if (category !== undefined) {
      product.category = category ? category.trim() : undefined;
    }

    if (defaultUsageCycleDays !== undefined) {
      if ([30, 45].includes(Number(defaultUsageCycleDays))) {
        product.defaultUsageCycleDays = Number(defaultUsageCycleDays);
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

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
