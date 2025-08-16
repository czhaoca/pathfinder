import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column {
  key: string;
  header: React.ReactNode;
  render?: (item: any) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  sortBy?: { field: string; direction: 'asc' | 'desc' };
  onSort?: (sortConfig: { field: string; direction: 'asc' | 'desc' }) => void;
  emptyMessage?: string;
  loading?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  sortBy,
  onSort,
  emptyMessage = 'No data available',
  loading = false
}) => {
  const handleSort = (field: string) => {
    if (!onSort) return;
    
    const direction = sortBy?.field === field && sortBy.direction === 'asc' ? 'desc' : 'asc';
    onSort({ field, direction });
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && sortBy?.field === column.key && (
                      <span className="text-blue-600">
                        {sortBy.direction === 'asc' ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={item.id || index} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {column.render ? column.render(item) : item[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};