import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Check } from 'lucide-react';

const TIME_SLOTS = [
  { label: '09:00 AM', value: '09:00' },
  { label: '09:30 AM', value: '09:30' },
  { label: '10:00 AM', value: '10:00' },
  { label: '10:30 AM', value: '10:30' },
  { label: '11:00 AM', value: '11:00' },
  { label: '11:30 AM', value: '11:30' },
  { label: '12:00 PM', value: '12:00' },
  { label: '12:30 PM', value: '12:30' },
  { label: '01:00 PM', value: '13:00' },
  { label: '01:30 PM', value: '13:30' },
  { label: '02:00 PM', value: '14:00' },
  { label: '02:30 PM', value: '14:30' },
  { label: '03:00 PM', value: '15:00' },
  { label: '03:30 PM', value: '15:30' },
  { label: '04:00 PM', value: '16:00' },
  { label: '04:30 PM', value: '16:30' },
  { label: '05:00 PM', value: '17:00' },
  { label: '05:30 PM', value: '17:30' },
  { label: '06:00 PM', value: '18:00' },
  { label: '06:30 PM', value: '18:30' },
  { label: '07:00 PM', value: '19:00' },
];

export default function CustomTimePicker({
  selectedTime,
  onChange,
  placeholder = '08:00',
  required = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeDigits, setTimeDigits] = useState('10:00');
  const [ampm, setAmPm] = useState('AM');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220 });

  const inputContainerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Helper to parse any time string into 12hr digits + AM/PM
  const parseTimeToParts = (val) => {
    if (!val) {
      const now = new Date();
      let hrs = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, '0');
      const period = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12 || 12;
      return { digits: `${String(hrs).padStart(2, '0')}:${mins}`, ampm: period };
    }

    // Standard 24hr HH:mm
    const parts = val.split(':');
    if (parts.length === 2) {
      let hrs = parseInt(parts[0], 10);
      const mins = parts[1].slice(0, 2);
      if (!isNaN(hrs)) {
        const period = hrs >= 12 ? 'PM' : 'AM';
        hrs = hrs % 12 || 12;
        return { digits: `${String(hrs).padStart(2, '0')}:${mins}`, ampm: period };
      }
    }
    return { digits: val, ampm: 'AM' };
  };

  // Convert 12hr digits + AM/PM to 24hr string for DB
  const formatTo24Hr = (digits, period) => {
    if (!digits) return '';
    const parts = digits.split(':');
    if (parts.length === 2) {
      let hrs = parseInt(parts[0], 10);
      const mins = parts[1];
      if (isNaN(hrs)) return digits;
      if (period === 'PM' && hrs < 12) hrs += 12;
      if (period === 'AM' && hrs === 12) hrs = 0;
      return `${String(hrs).padStart(2, '0')}:${mins}`;
    }
    return digits;
  };

  useEffect(() => {
    const { digits, ampm: period } = parseTimeToParts(selectedTime);
    setTimeDigits(digits);
    setAmPm(period);

    if (!selectedTime && onChange) {
      onChange(formatTo24Hr(digits, period));
    }
  }, [selectedTime]);

  const updatePosition = () => {
    if (inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 220)
      });
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputContainerRef.current && !inputContainerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDigitsChange = (e) => {
    const val = e.target.value;
    setTimeDigits(val);
    if (onChange) {
      onChange(formatTo24Hr(val, ampm));
    }
  };

  const handleAmPmChange = (e) => {
    const newPeriod = e.target.value;
    setAmPm(newPeriod);
    if (onChange) {
      onChange(formatTo24Hr(timeDigits, newPeriod));
    }
  };

  const handleSelectSlot = (slotValue) => {
    const { digits, ampm: period } = parseTimeToParts(slotValue);
    setTimeDigits(digits);
    setAmPm(period);
    if (onChange) {
      onChange(slotValue);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full font-sans ${className}`} ref={inputContainerRef}>
      {/* Input container with integrated AM/PM dropdown selector */}
      <div className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl transition shadow-2xs focus-within:ring-2 focus-within:ring-red-500/80 focus-within:border-red-500 ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}>
        {/* Editable Time Digits Field */}
        <input
          type="text"
          value={timeDigits}
          onChange={handleDigitsChange}
          onFocus={handleOpen}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none placeholder-slate-400"
        />

        {/* Integrated AM / PM Dropdown Selector */}
        <select
          value={ampm}
          onChange={handleAmPmChange}
          disabled={disabled}
          className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer shrink-0 shadow-2xs"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>

        {/* Quick Slot Trigger Button */}
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
          tabIndex={-1}
          disabled={disabled}
          className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 shrink-0"
          title="Choose time slot"
        >
          <Clock size={16} />
        </button>
      </div>

      {/* Floating Quick Time Slots Dropdown Portaled to Body */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'absolute',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
            }}
            className="z-[999999] bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 max-h-60 overflow-y-auto scrollbar-hide space-y-2 font-sans"
          >
            <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Quick Time Slots
              </span>
            </div>

            <div className="space-y-0.5">
              {TIME_SLOTS.map((slot) => {
                const isSelected = formatTo24Hr(timeDigits, ampm) === slot.value;
                return (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => handleSelectSlot(slot.value)}
                    className={`w-full px-3 py-1.5 text-left rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-red-50 text-red-600 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{slot.label}</span>
                    {isSelected && <Check size={14} className="text-red-600" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
