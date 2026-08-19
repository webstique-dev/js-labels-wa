const mongoose = require('mongoose');

/**
 * Mongoose Soft-Delete Plugin
 * 
 * Adds isDeleted, deletedAt, deletedBy fields to any schema.
 * Automatically excludes soft-deleted documents from find/findOne/countDocuments/aggregate
 * unless the query explicitly opts in via { includeDeleted: true } in query options.
 * 
 * Usage:
 *   const softDeletePlugin = require('../utils/softDelete');
 *   mySchema.plugin(softDeletePlugin);
 * 
 * Instance methods added:
 *   doc.softDelete(userId) — marks as deleted
 *   doc.restore()          — unmarks as deleted
 */
function softDeletePlugin(schema) {
  // 1. Add soft-delete fields
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  });

  // 2. Helper to inject filter if not opted out
  const addNotDeletedFilter = function () {
    const opts = this.getOptions();
    if (opts && opts.includeDeleted === true) return;

    const conditions = this.getFilter();
    // Don't override if isDeleted is already explicitly set in the query
    if (conditions.isDeleted !== undefined) return;

    this.where({ isDeleted: { $ne: true } });
  };

  // 3. Pre-hooks for query operations
  schema.pre('find', addNotDeletedFilter);
  schema.pre('findOne', addNotDeletedFilter);
  schema.pre('countDocuments', addNotDeletedFilter);
  schema.pre('findOneAndUpdate', addNotDeletedFilter);

  // 4. Pre-hook for aggregate
  schema.pre('aggregate', function () {
    const opts = this.options || {};
    if (opts.includeDeleted === true) return;

    // Check if first stage already has isDeleted filter
    const pipeline = this.pipeline();
    if (pipeline.length > 0 && pipeline[0].$match && pipeline[0].$match.isDeleted !== undefined) {
      return;
    }

    // Prepend a $match to exclude deleted documents
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  });

  // 5. Instance method: softDelete
  schema.methods.softDelete = async function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId || null;
    return this.save();
  };

  // 6. Instance method: restore
  schema.methods.restore = async function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
}

module.exports = softDeletePlugin;
