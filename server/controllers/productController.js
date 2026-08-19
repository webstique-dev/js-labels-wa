const Product = require('../models/Product');

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ message: 'Server error fetching products' });
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
    return res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Server error deleting product' });
  }
};

module.exports = {
  getProducts,
  deleteProduct
};
