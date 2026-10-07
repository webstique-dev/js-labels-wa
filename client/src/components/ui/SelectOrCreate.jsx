import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, Plus, Check, X, Trash2 } from 'lucide-react';

/**
 * Reusable Select-or-Create searchable combobox dropdown.
 * 
 * Features:
 * - Smart auto-positioning (opens up or down depending on available viewport/modal space)
 * - Constrained maximum height to prevent viewport clipping
 * - 100% hidden scrollbars across all browsers while retaining full wheel/touch/keyboard scrolling
 * - Clean "+ Add 'New Value'" displayed prominently at the top
 * - Soft-delete trash icon for custom options with confirmation callback
 * - Protected system options (cannot be deleted)
 * - Mobile & touch friendly
 * - Full keyboard navigation (ArrowUp/Down, Enter, Escape, PageUp/Down)
 * - Click-outside dismiss
 */
export default function SelectOrCreate({
  value,
  onChange,
  options = [],
  protectedOptions = [],
  placeholder = 'Select or type...',
  label,
  required = false,
  disabled = false,
  allowCustom = true,
  allowDelete = true,
  onCreateOption,
  onDeleteOption,
  isOptionRemovable,
  className = '',
  id,
  name,
  error,
  icon: Icon,
  formatOptionLabel,
  formatSelectedLabel,
  createPrompt = 'Add'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPlacement, setDropdownPlacement] = useState('down'); // 'down' | 'up'
  const [maxListHeight, setMaxListHeight] = useState(200);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize protected options map for fast case-insensitive lookup
  const protectedSet = useMemo(() => {
    const set = new Set();
    (protectedOptions || []).forEach((opt) => {
      const val = opt && typeof opt === 'object' && opt.value !== undefined ? opt.value : opt;
      if (val !== undefined && val !== null) {
        set.add(String(val).trim().toLowerCase());
      }
    });
    return set;
  }, [protectedOptions]);

  // Normalize options to { value, label, isCustom } structure
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt) => {
      let optValue = opt;
      let optLabel = '';

      if (opt && typeof opt === 'object' && opt.value !== undefined) {
        optValue = opt.value;
        optLabel = opt.label !== undefined ? String(opt.label) : String(opt.value);
      } else {
        optValue = opt;
        optLabel = formatOptionLabel ? formatOptionLabel(opt) : String(opt);
      }

      const strVal = String(optValue).trim().toLowerCase();
      const isProtected = protectedSet.has(strVal);
      const isRemovable = isOptionRemovable
        ? isOptionRemovable(optValue)
        : allowDelete && !isProtected;

      return {
        value: optValue,
        label: optLabel,
        isRemovable
      };
    });
  }, [options, formatOptionLabel, protectedSet, isOptionRemovable, allowDelete]);

  // Find currently selected item label
  const selectedLabel = useMemo(() => {
    if (value === '' || value === null || value === undefined) return '';
    if (formatSelectedLabel) return formatSelectedLabel(value);
    const match = normalizedOptions.find(
      (opt) => String(opt.value).toLowerCase() === String(value).toLowerCase()
    );
    if (match) return match.label;
    return formatOptionLabel ? formatOptionLabel(value) : String(value);
  }, [value, normalizedOptions, formatOptionLabel, formatSelectedLabel]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const cleanSearch = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(cleanSearch) ||
      String(opt.value).toLowerCase().includes(cleanSearch)
    );
  }, [normalizedOptions, searchTerm]);

  // Check if search query matches an existing option exactly (case-insensitive)
  const exactMatchExists = useMemo(() => {
    const clean = searchTerm.trim().toLowerCase();
    if (!clean) return true;
    return normalizedOptions.some(
      (opt) =>
        opt.label.toLowerCase() === clean ||
        String(opt.value).toLowerCase() === clean
    );
  }, [normalizedOptions, searchTerm]);

  // Determine whether to show the "Add new" option
  const showAddOption = allowCustom && searchTerm.trim().length > 0 && !exactMatchExists;

  // Combine items for keyboard navigation: [ (optional addOption at index 0), ...filteredOptions ]
  const totalItemsCount = (showAddOption ? 1 : 0) + filteredOptions.length;

  // Calculate intelligent placement (up or down) & max-height based on available viewport space
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    const spaceBelow = windowHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    // Default dropdown height is around 220px (including search box)
    const requiredHeight = 220;

    if (spaceBelow < requiredHeight && spaceAbove > spaceBelow) {
      setDropdownPlacement('up');
      setMaxListHeight(Math.min(220, Math.max(120, spaceAbove - 60)));
    } else {
      setDropdownPlacement('down');
      setMaxListHeight(Math.min(220, Math.max(120, spaceBelow - 60)));
    }
  }, []);

  // Update position on open and on window resize/scroll
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setSearchTerm('');
      setHighlightedIndex(0);

      const handleResizeOrScroll = () => updatePosition();
      window.addEventListener('resize', handleResizeOrScroll);
      window.addEventListener('scroll', handleResizeOrScroll, true);

      const timeout = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);

      return () => {
        window.removeEventListener('resize', handleResizeOrScroll);
        window.removeEventListener('scroll', handleResizeOrScroll, true);
        clearTimeout(timeout);
      };
    } else {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  }, [isOpen, updatePosition]);

  // Close when clicking outside - uses 'click' so outside buttons/controls receive their click immediately on the 1st press
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside, false);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside, false);
    };
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current && highlightedIndex >= 0) {
      const activeEl = listRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Handle selecting an existing option
  const handleSelectOption = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
  };

  // Handle creating a new option
  const handleCreateNew = (customText) => {
    const trimmed = (customText || searchTerm).trim();
    if (!trimmed) return;

    if (onCreateOption) {
      onCreateOption(trimmed);
    }
    onChange(trimmed);
    setIsOpen(false);
  };

  // Handle deleting an existing custom option
  const handleDelete = (e, optValue) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDeleteOption) {
      onDeleteOption(optValue);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % (totalItemsCount || 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + totalItemsCount) % (totalItemsCount || 1));
        break;
      case 'PageDown':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(totalItemsCount - 1, prev + 4));
        break;
      case 'PageUp':
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(0, prev - 4));
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(totalItemsCount - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (showAddOption && highlightedIndex === 0) {
          handleCreateNew(searchTerm);
        } else {
          const optIdx = showAddOption ? highlightedIndex - 1 : highlightedIndex;
          if (optIdx >= 0 && optIdx < filteredOptions.length) {
            handleSelectOption(filteredOptions[optIdx].value);
          } else if (showAddOption) {
            handleCreateNew(searchTerm);
          }
        }
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Control */}
      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={!disabled ? handleKeyDown : undefined}
        className={`w-full h-[42px] px-3.5 bg-white hover:bg-slate-50 border rounded-xl flex items-center justify-between gap-2 transition cursor-pointer select-none text-xs font-semibold shadow-2xs ${
          error
            ? 'border-red-400 focus:ring-2 focus:ring-red-500/20'
            : isOpen
            ? 'border-red-500 ring-2 ring-red-500/20 bg-white shadow-xs'
            : 'border-slate-300 hover:border-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
      >
        <div className="flex items-center gap-2 overflow-hidden text-left">
          {Icon && (
            <Icon size={16} className="text-slate-400 shrink-0 stroke-[2]" />
          )}
          {selectedLabel ? (
            <span className="text-slate-900 truncate font-semibold">
              {selectedLabel}
            </span>
          ) : (
            <span className="text-slate-400 truncate font-normal">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-red-600' : 'text-slate-400'
            }`}
          />
        </div>
      </div>

      {error && (
        <p className="text-[11px] font-medium text-red-500 mt-1">{error}</p>
      )}

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 min-w-[220px] ${
            dropdownPlacement === 'up'
              ? 'bottom-full mb-1.5'
              : 'top-full mt-1.5'
          }`}
          style={{
            boxShadow: '0 12px 36px -4px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08)'
          }}
        >
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-3 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search or type new..."
                className="w-full pl-8.5 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Options List with 100% hidden scrollbar across all browsers */}
          <div
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="overflow-y-auto p-1.5 space-y-0.5 scrollbar-hide text-xs"
            style={{
              maxHeight: `${maxListHeight}px`,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {/* "+ Add New Option" button - Shown at the TOP of the list */}
            {showAddOption && (
              <div
                role="option"
                aria-selected={highlightedIndex === 0}
                onMouseEnter={() => setHighlightedIndex(0)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCreateNew(searchTerm);
                }}
                onClick={() => handleCreateNew(searchTerm)}
                className={`w-full px-3 py-2 rounded-xl flex items-center gap-2 transition cursor-pointer border border-dashed border-red-200 text-red-600 font-semibold mb-1 ${
                  highlightedIndex === 0
                    ? 'bg-red-50 border-red-400 text-red-700 shadow-2xs'
                    : 'bg-red-50/40 hover:bg-red-50'
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <Plus size={13} className="stroke-[3]" />
                </div>
                <div className="truncate flex-1">
                  <span>{createPrompt} </span>
                  <span className="underline decoration-red-300">
                    &ldquo;{searchTerm.trim()}&rdquo;
                  </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  New
                </span>
              </div>
            )}

            {/* Filtered Existing Options */}
            {filteredOptions.map((opt, idx) => {
              const itemVisualIndex = showAddOption ? idx + 1 : idx;
              const isSelected =
                String(opt.value).toLowerCase() === String(value).toLowerCase();
              const isHighlighted = itemVisualIndex === highlightedIndex;

              return (
                <div
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(itemVisualIndex)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectOption(opt.value);
                  }}
                  onClick={() => handleSelectOption(opt.value)}
                  className={`group w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                    isSelected
                      ? 'bg-red-50 text-red-700 font-semibold'
                      : isHighlighted
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate flex-1 text-left">{opt.label}</span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Delete button for custom/removable options */}
                    {opt.isRemovable && (
                      <button
                        type="button"
                        title="Delete custom option"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => handleDelete(e, opt.value)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    {/* Checkmark for selected item */}
                    {isSelected && (
                      <Check size={14} className="text-red-600 shrink-0 stroke-[2.5]" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Empty State */}
            {filteredOptions.length === 0 && !showAddOption && (
              <div className="py-6 px-4 text-center text-slate-400">
                <p className="text-xs font-medium">No matching options</p>
                {searchTerm && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    No results for &ldquo;{searchTerm}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
