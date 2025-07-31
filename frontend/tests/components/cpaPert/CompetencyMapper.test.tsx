import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CompetencyMapper } from '@/components/cpaPert/CompetencyMapper';
import { CompetencyMapping } from '@/types/cpaPert';

describe('CompetencyMapper', () => {
  const mockMappings: CompetencyMapping[] = [
    {
      mapping_id: '1',
      experience_id: 'exp123',
      competency_id: '1',
      main_code: 'FR',
      main_name: 'Financial Reporting',
      sub_code: 'FR1',
      sub_name: 'Financial Reporting Needs',
      category: 'Technical',
      relevance_score: 0.95,
      evidence: JSON.stringify(['Prepared financial statements', 'Analyzed reporting requirements']),
      suggested_proficiency: 2,
      created_at: new Date().toISOString()
    },
    {
      mapping_id: '2',
      experience_id: 'exp123',
      competency_id: '2',
      main_code: 'MA',
      main_name: 'Management Accounting',
      sub_code: 'MA1',
      sub_name: 'Management Information Needs',
      category: 'Technical',
      relevance_score: 0.85,
      evidence: JSON.stringify(['Created management reports']),
      suggested_proficiency: 1,
      created_at: new Date().toISOString()
    },
    {
      mapping_id: '3',
      experience_id: 'exp123',
      competency_id: '3',
      main_code: 'TX',
      main_name: 'Taxation',
      sub_code: 'TX1',
      sub_name: 'Tax Compliance',
      category: 'Technical',
      relevance_score: 0.65,
      evidence: JSON.stringify(['Basic tax knowledge']),
      suggested_proficiency: 0,
      created_at: new Date().toISOString()
    }
  ];

  const mockExistingResponses = [
    {
      response_id: 'resp1',
      competency_id: '1',
      is_current: 1
    }
  ];

  it('should render competency mappings', () => {
    render(<CompetencyMapper mappings={mockMappings} />);

    expect(screen.getByText('FR1 - Financial Reporting Needs')).toBeInTheDocument();
    expect(screen.getByText('MA1 - Management Information Needs')).toBeInTheDocument();
    expect(screen.getByText('TX1 - Tax Compliance')).toBeInTheDocument();
  });

  it('should display relevance scores with appropriate styling', () => {
    render(<CompetencyMapper mappings={mockMappings} />);

    // High relevance (95%)
    expect(screen.getByText('95%')).toHaveClass('text-green-600');
    
    // Medium relevance (85%)
    expect(screen.getByText('85%')).toHaveClass('text-blue-600');
    
    // Lower relevance (65%)
    expect(screen.getByText('65%')).toHaveClass('text-orange-600');
  });

  it('should show evidence items', () => {
    render(<CompetencyMapper mappings={mockMappings} />);

    expect(screen.getByText('Prepared financial statements')).toBeInTheDocument();
    expect(screen.getByText('Analyzed reporting requirements')).toBeInTheDocument();
    expect(screen.getByText('Created management reports')).toBeInTheDocument();
  });

  it('should display suggested proficiency levels', () => {
    render(<CompetencyMapper mappings={mockMappings} />);

    expect(screen.getByText('Suggested: Level 2')).toBeInTheDocument();
    expect(screen.getByText('Suggested: Level 1')).toBeInTheDocument();
    expect(screen.getByText('Suggested: Level 0')).toBeInTheDocument();
  });

  it('should show summary statistics', () => {
    render(<CompetencyMapper mappings={mockMappings} />);

    expect(screen.getByText('3')).toBeInTheDocument(); // Total competencies
    expect(screen.getByText('1')).toBeInTheDocument(); // Strong matches
    expect(screen.getByText('82%')).toBeInTheDocument(); // Average relevance
  });

  it('should call onSelectMapping when clicking a mapping', () => {
    const mockOnSelectMapping = vi.fn();
    render(
      <CompetencyMapper 
        mappings={mockMappings} 
        onSelectMapping={mockOnSelectMapping}
      />
    );

    const firstMapping = screen.getByText('FR1 - Financial Reporting Needs')
      .closest('.cursor-pointer');
    
    fireEvent.click(firstMapping!);
    
    expect(mockOnSelectMapping).toHaveBeenCalledWith(mockMappings[0]);
  });

  it('should show existing response indicator', () => {
    render(
      <CompetencyMapper 
        mappings={mockMappings} 
        existingResponses={mockExistingResponses as any}
      />
    );

    const existingBadge = screen.getByText('Has Response');
    expect(existingBadge).toBeInTheDocument();
  });

  it('should filter mappings by category', () => {
    const mixedMappings = [
      ...mockMappings,
      {
        ...mockMappings[0],
        mapping_id: '4',
        category: 'Enabling',
        sub_code: 'PD1',
        sub_name: 'Professional Development'
      }
    ];

    render(<CompetencyMapper mappings={mixedMappings} />);

    // Check that both categories are shown
    expect(screen.getByText('Technical Competencies')).toBeInTheDocument();
    expect(screen.getByText('Enabling Competencies')).toBeInTheDocument();
  });

  it('should handle empty mappings', () => {
    render(<CompetencyMapper mappings={[]} />);

    // Should still render without errors
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // Total competencies
  });

  it('should handle evidence parsing errors gracefully', () => {
    const invalidMapping = {
      ...mockMappings[0],
      evidence: 'invalid json'
    };

    render(<CompetencyMapper mappings={[invalidMapping]} />);

    // Should render the mapping without crashing
    expect(screen.getByText('FR1 - Financial Reporting Needs')).toBeInTheDocument();
  });

  it('should be keyboard accessible', () => {
    const mockOnSelectMapping = vi.fn();
    render(
      <CompetencyMapper 
        mappings={mockMappings} 
        onSelectMapping={mockOnSelectMapping}
      />
    );

    const firstMapping = screen.getByText('FR1 - Financial Reporting Needs')
      .closest('.cursor-pointer') as HTMLElement;

    // Simulate keyboard interaction
    firstMapping.focus();
    fireEvent.keyDown(firstMapping, { key: 'Enter' });

    expect(mockOnSelectMapping).toHaveBeenCalledWith(mockMappings[0]);
  });
});