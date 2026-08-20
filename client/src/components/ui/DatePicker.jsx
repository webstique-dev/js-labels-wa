import React, { forwardRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

// Custom Responsive Editable Input
const CustomInput = forwardRef(({ value, onClick, onChange, placeholder, required, disabled, name }, ref) => (
  <div className="relative w-full">
    <input
      type="text"
      ref={ref}
      value={value || ''}
      onClick={onClick}
      onChange={onChange}
      placeholder={placeholder || 'YYYY-MM-DD'}
      required={required}
      disabled={disabled}
      name={name}
      className={`w-full pl-3.5 pr-9 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/80 transition cursor-pointer shadow-2xs ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    />
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      disabled={disabled}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1"
    >
      <CalendarIcon size={16} />
    </button>
  </div>
));

CustomInput.displayName = 'CustomInput';

export default function CustomDatePicker({
  selectedDate,
  onChange,
  placeholder = 'Select or type date',
  minDate,
  maxDate,
  required = false,
  disabled = false,
  className = ''
}) {
  const getLiveDateStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Convert YYYY-MM-DD string to Date object or vice-versa
  const parseStringToDate = (str) => {
    if (!str) return null;
    if (str instanceof Date) return isNaN(str.getTime()) ? null : str;
    
    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    // DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const activeDateStr = selectedDate || getLiveDateStr();
  const dateValue = parseStringToDate(activeDateStr);

  useEffect(() => {
    if (!selectedDate && onChange) {
      onChange(getLiveDateStr());
    }
  }, []);

  const handleDateChange = (date) => {
    if (!date || isNaN(date.getTime())) {
      onChange('');
      return;
    }
    // Format to YYYY-MM-DD string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const formattedStr = `${year}-${month}-${day}`;
    onChange(formattedStr);
  };

  const handleRawInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    const parsed = parseStringToDate(val);
    if (parsed) {
      handleDateChange(parsed);
    }
  };

  return (
    <div className={`relative w-full font-sans ${className}`}>
      <ReactDatePicker
        selected={dateValue}
        onChange={handleDateChange}
        onChangeRaw={handleRawInputChange}
        dateFormat="yyyy-MM-dd"
        minDate={minDate}
        maxDate={maxDate}
        popperContainer={({ children }) => createPortal(children, document.body)}
        popperPlacement="bottom-start"
        customInput={
          <CustomInput
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        }
        popperClassName="react-datepicker-custom-popper z-[999999]"
        calendarClassName="bg-white border border-slate-200 shadow-2xl rounded-2xl p-3 font-sans"
        renderCustomHeader={({
          date,
          changeYear,
          changeMonth,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled
        }) => {
          const currentYear = date.getFullYear();
          const currentMonth = date.getMonth();
          const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
          ];
          const startYear = 2020;
          const endYear = 2035;
          const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

          return (
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-2 gap-1">
              <div className="flex items-center gap-1.5">
                <select
                  value={currentMonth}
                  onChange={({ target: { value } }) => changeMonth(Number(value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                >
                  {months.map((m, i) => (
                    <option key={m} value={i}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={({ target: { value } }) => changeYear(Number(value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={increaseMonth}
                  disabled={nextMonthButtonDisabled}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
