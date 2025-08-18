import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import './DateRangePicker.css';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (range: { start: Date; end: Date }) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate = new Date()
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ start, end });
    setIsOpen(false);
  };

  const handleApply = () => {
    if (tempStart <= tempEnd) {
      onChange({ start: tempStart, end: tempEnd });
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setTempStart(startDate);
    setTempEnd(endDate);
    setIsOpen(false);
  };

  return (
    <div className="date-range-picker">
      <button
        className="date-range-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar className="icon" />
        <span>
          {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
        </span>
      </button>

      {isOpen && (
        <div className="date-range-dropdown">
          <div className="quick-select">
            <button onClick={() => handleQuickSelect(7)}>Last 7 days</button>
            <button onClick={() => handleQuickSelect(30)}>Last 30 days</button>
            <button onClick={() => handleQuickSelect(90)}>Last 90 days</button>
          </div>

          <div className="date-inputs">
            <div className="date-input-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                id="start-date"
                type="date"
                value={formatDate(tempStart)}
                min={minDate ? formatDate(minDate) : undefined}
                max={formatDate(tempEnd)}
                onChange={(e) => setTempStart(new Date(e.target.value))}
              />
            </div>

            <div className="date-input-group">
              <label htmlFor="end-date">End Date</label>
              <input
                id="end-date"
                type="date"
                value={formatDate(tempEnd)}
                min={formatDate(tempStart)}
                max={maxDate ? formatDate(maxDate) : undefined}
                onChange={(e) => setTempEnd(new Date(e.target.value))}
              />
            </div>
          </div>

          <div className="date-range-actions">
            <button className="btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn-apply" onClick={handleApply}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
};