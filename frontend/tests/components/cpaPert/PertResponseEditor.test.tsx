import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PertResponseEditor } from '@/components/cpaPert/PertResponseEditor';
import { useCPAPert } from '@/hooks/useCPAPert';
import { toast } from 'sonner';
import { Experience } from '@/types/experience';
import { CompetencyMapping, PertResponse } from '@/types/cpaPert';

// Mock hooks and services
vi.mock('@/hooks/useCPAPert');
vi.mock('sonner');

describe('PertResponseEditor', () => {
  const mockExperience: Experience = {
    experienceId: 'exp123',
    userId: 'user123',
    title: 'Senior Accountant',
    organization: 'Test Company',
    type: 'work',
    startDate: '2022-01-01',
    endDate: '2023-12-31',
    location: 'Toronto, ON',
    description: 'Managed financial reporting and analysis',
    achievements: ['Improved efficiency by 30%'],
    skills: ['Financial Reporting', 'GAAP'],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockCompetencyMapping: CompetencyMapping = {
    mapping_id: '1',
    experience_id: 'exp123',
    competency_id: '1',
    main_code: 'FR',
    main_name: 'Financial Reporting',
    sub_code: 'FR1',
    sub_name: 'Financial Reporting Needs',
    category: 'Technical',
    relevance_score: 0.95,
    evidence: JSON.stringify(['Test evidence']),
    suggested_proficiency: 2,
    created_at: new Date().toISOString()
  };

  const mockPertResponse: PertResponse = {
    response_id: 'resp123',
    user_id: 'user123',
    experience_id: 'exp123',
    competency_id: '1',
    main_code: 'FR',
    main_name: 'Financial Reporting',
    sub_code: 'FR1',
    sub_name: 'Financial Reporting Needs',
    proficiency_level: 2,
    situation_text: 'Test situation',
    task_text: 'Test task',
    action_text: 'Test action',
    result_text: 'Test result',
    response_text: 'SITUATION:\nTest situation\n\nTASK:\nTest task\n\nACTION:\nTest action\n\nRESULT:\nTest result',
    character_count: 100,
    quantified_impact: 'Reduced errors by 50%',
    is_current: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockUseCPAPert = {
    generatePERTResponse: vi.fn(),
    updatePERTResponse: vi.fn(),
    loading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCPAPert).mockReturnValue(mockUseCPAPert as any);
  });

  describe('rendering', () => {
    it('should render editor with experience info', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
        />
      );

      expect(screen.getByText('PERT Response Editor')).toBeInTheDocument();
      expect(screen.getByText('FR1 - Financial Reporting Needs')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
    });

    it('should show generation controls for new response', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
        />
      );

      expect(screen.getByLabelText('Competency')).toBeInTheDocument();
      expect(screen.getByLabelText('Proficiency Level')).toBeInTheDocument();
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    it('should show existing response content', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      expect(screen.getByDisplayValue('Test situation')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test task')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test action')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test result')).toBeInTheDocument();
    });
  });

  describe('generation', () => {
    it('should generate new PERT response', async () => {
      mockUseCPAPert.generatePERTResponse.mockResolvedValue(mockPertResponse);

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
        />
      );

      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(mockUseCPAPert.generatePERTResponse).toHaveBeenCalledWith(
          'exp123',
          '1',
          1 // Default proficiency level
        );
      });
    });

    it('should require competency selection', async () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
        />
      );

      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select a competency');
      });
    });

    it('should update UI after generation', async () => {
      mockUseCPAPert.generatePERTResponse.mockResolvedValue(mockPertResponse);
      const onResponseSaved = vi.fn();

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          onResponseSaved={onResponseSaved}
        />
      );

      const generateButton = screen.getByText('Generate');
      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(onResponseSaved).toHaveBeenCalledWith(mockPertResponse);
        expect(screen.getByDisplayValue('Test situation')).toBeInTheDocument();
      });
    });
  });

  describe('editing', () => {
    it('should update section text', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      const situationTextarea = screen.getByLabelText(/Situation/);
      fireEvent.change(situationTextarea, { target: { value: 'Updated situation' } });

      expect(situationTextarea).toHaveValue('Updated situation');
    });

    it('should track character count', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      expect(screen.getByText('100 / 5000')).toBeInTheDocument();
    });

    it('should show character limit warnings', () => {
      const longResponse = {
        ...mockPertResponse,
        response_text: 'x'.repeat(4600),
        character_count: 4600
      };

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={longResponse}
        />
      );

      expect(screen.getByText('4600 / 5000')).toHaveClass('text-orange-600');
    });

    it('should switch between structured and full text views', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      // Switch to full text view
      fireEvent.click(screen.getByText('Full Text'));

      const fullTextarea = screen.getByPlaceholderText('Edit the full PERT response...');
      expect(fullTextarea).toHaveValue(mockPertResponse.response_text);
    });
  });

  describe('saving', () => {
    it('should save changes to existing response', async () => {
      mockUseCPAPert.updatePERTResponse.mockResolvedValue(mockPertResponse);
      const onResponseSaved = vi.fn();

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
          onResponseSaved={onResponseSaved}
        />
      );

      // Make a change
      const situationTextarea = screen.getByLabelText(/Situation/);
      fireEvent.change(situationTextarea, { target: { value: 'Updated situation' } });

      // Save
      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUseCPAPert.updatePERTResponse).toHaveBeenCalledWith(
          'resp123',
          expect.objectContaining({
            situationText: 'Updated situation'
          })
        );
        expect(onResponseSaved).toHaveBeenCalledWith(mockPertResponse);
      });
    });

    it('should validate character limit before saving', async () => {
      const longResponse = {
        ...mockPertResponse,
        response_text: 'x'.repeat(5100),
        character_count: 5100
      };

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={longResponse}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Response exceeds 5000 character limit');
      });
    });
  });

  describe('utility functions', () => {
    it('should copy response to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockPertResponse.response_text);
      expect(toast.success).toHaveBeenCalledWith('Copied to clipboard');
    });

    it('should download response as text file', () => {
      const mockCreateElement = vi.spyOn(document, 'createElement');
      const mockClick = vi.fn();
      const mockRemove = vi.fn();
      
      mockCreateElement.mockReturnValue({
        click: mockClick,
        remove: mockRemove,
        href: '',
        download: ''
      } as any);

      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      const downloadButton = screen.getByText('Download');
      fireEvent.click(downloadButton);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Downloaded successfully');
    });

    it('should reset changes', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
        />
      );

      // Make a change
      const situationTextarea = screen.getByLabelText(/Situation/);
      fireEvent.change(situationTextarea, { target: { value: 'Changed text' } });

      // Reset
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);

      expect(situationTextarea).toHaveValue('Test situation');
    });
  });

  describe('read-only mode', () => {
    it('should disable editing in read-only mode', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={mockPertResponse}
          readOnly={true}
        />
      );

      const situationTextarea = screen.getByLabelText(/Situation/);
      expect(situationTextarea).toBeDisabled();

      // Save button should not be present
      expect(screen.queryByText('Save Changes')).not.toBeInTheDocument();
    });
  });

  describe('proficiency level guidance', () => {
    it('should show appropriate level expectations', () => {
      render(
        <PertResponseEditor 
          experience={mockExperience}
          competencyMapping={mockCompetencyMapping}
          existingResponse={{...mockPertResponse, proficiency_level: 0}}
        />
      );

      expect(screen.getByText(/Basic understanding and application under supervision/))
        .toBeInTheDocument();
    });
  });
});