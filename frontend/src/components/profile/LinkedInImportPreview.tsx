/**
 * LinkedIn Import Preview Component
 * Shows preview of LinkedIn data and allows selective import
 */

import React, { useState, useEffect } from 'react';
import { linkedInService } from '../../services/linkedInService';
import { useAuthStore } from '../../stores/authStore';
import { useProfileStore } from '../../stores/profileStore';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { useToast } from '../../hooks/useToast';

interface ImportOptions {
  workExperience: boolean;
  education: boolean;
  skills: boolean;
  certifications: boolean;
  summary: boolean;
  profilePhoto: boolean;
  location: boolean;
  industry: boolean;
}

interface LinkedInImportPreviewProps {
  detailed?: boolean;
  onCancel?: () => void;
  onImportComplete?: (imported: any) => void;
}

export const LinkedInImportPreview: React.FC<LinkedInImportPreviewProps> = ({
  detailed = false,
  onCancel,
  onImportComplete
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    workExperience: true,
    education: true,
    skills: true,
    certifications: true,
    summary: true,
    profilePhoto: true,
    location: true,
    industry: true
  });
  const [selectedItems, setSelectedItems] = useState<Map<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const { user } = useAuthStore();
  const { refreshProfile } = useProfileStore();
  const { showToast } = useToast();

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { preview } = await linkedInService.previewImport();
      setPreviewData(preview);
      
      // Initialize selected items for detailed view
      if (detailed && preview) {
        const items = new Map<string, boolean>();
        
        preview.workExperience?.forEach((exp: any, index: number) => {
          items.set(`work-${index}`, true);
        });
        
        preview.education?.forEach((edu: any, index: number) => {
          items.set(`edu-${index}`, true);
        });
        
        preview.skills?.forEach((skill: any, index: number) => {
          items.set(`skill-${index}`, true);
        });
        
        preview.certifications?.forEach((cert: any, index: number) => {
          items.set(`cert-${index}`, true);
        });
        
        setSelectedItems(items);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load preview';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);

    try {
      // Filter options based on selected items if in detailed mode
      let finalOptions = { ...importOptions };
      
      if (detailed) {
        // Create selective import data
        const selectedWorkExp = previewData.workExperience?.filter((_: any, index: number) => 
          selectedItems.get(`work-${index}`)
        );
        
        const selectedEducation = previewData.education?.filter((_: any, index: number) => 
          selectedItems.get(`edu-${index}`)
        );
        
        const selectedSkills = previewData.skills?.filter((_: any, index: number) => 
          selectedItems.get(`skill-${index}`)
        );
        
        const selectedCerts = previewData.certifications?.filter((_: any, index: number) => 
          selectedItems.get(`cert-${index}`)
        );
        
        // Import with selected items
        const result = await linkedInService.importProfileSelective({
          ...finalOptions,
          workExperience: selectedWorkExp,
          education: selectedEducation,
          skills: selectedSkills,
          certifications: selectedCerts
        });
        
        setImportResult(result.imported);
      } else {
        // Import with category options
        const result = await linkedInService.importProfile(finalOptions);
        setImportResult(result.imported);
      }

      // Refresh profile data
      await refreshProfile();

      showToast({
        type: 'success',
        message: 'LinkedIn profile imported successfully'
      });

      if (onImportComplete) {
        onImportComplete(importResult);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      setError(errorMessage);
      showToast({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleOptionChange = (option: keyof ImportOptions) => {
    setImportOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const handleItemToggle = (itemId: string) => {
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, !newMap.get(itemId));
      return newMap;
    });
  };

  const renderWorkExperience = () => {
    if (!previewData?.workExperience || previewData.workExperience.length === 0) {
      return null;
    }

    return (
      <div className="import-preview__section">
        <h3 className="import-preview__section-title">
          <Checkbox
            checked={importOptions.workExperience}
            onChange={() => handleOptionChange('workExperience')}
            label="Work Experience"
          />
        </h3>
        
        {importOptions.workExperience && (
          <div className="import-preview__items">
            {previewData.workExperience.map((exp: any, index: number) => (
              <Card key={index} className="import-preview__item">
                {detailed && (
                  <Checkbox
                    checked={selectedItems.get(`work-${index}`) || false}
                    onChange={() => handleItemToggle(`work-${index}`)}
                    aria-label={`Select ${exp.title} at ${exp.company}`}
                  />
                )}
                <div className="import-preview__item-content">
                  <h4>{exp.title}</h4>
                  <p>{exp.company}</p>
                  <p className="import-preview__item-date">
                    {formatDate(exp.startDate)} - {exp.endDate ? formatDate(exp.endDate) : 'Present'}
                  </p>
                  {exp.description && (
                    <p className="import-preview__item-description">{exp.description}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEducation = () => {
    if (!previewData?.education || previewData.education.length === 0) {
      return null;
    }

    return (
      <div className="import-preview__section">
        <h3 className="import-preview__section-title">
          <Checkbox
            checked={importOptions.education}
            onChange={() => handleOptionChange('education')}
            label="Education"
          />
        </h3>
        
        {importOptions.education && (
          <div className="import-preview__items">
            {previewData.education.map((edu: any, index: number) => (
              <Card key={index} className="import-preview__item" data-testid="education-item">
                {detailed && (
                  <Checkbox
                    checked={selectedItems.get(`edu-${index}`) || false}
                    onChange={() => handleItemToggle(`edu-${index}`)}
                  />
                )}
                <div className="import-preview__item-content">
                  <h4>{edu.degree} in {edu.fieldOfStudy}</h4>
                  <p>{edu.institution}</p>
                  <p className="import-preview__item-date">
                    {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSkills = () => {
    if (!previewData?.skills || previewData.skills.length === 0) {
      return null;
    }

    return (
      <div className="import-preview__section">
        <h3 className="import-preview__section-title">
          <Checkbox
            checked={importOptions.skills}
            onChange={() => handleOptionChange('skills')}
            label="Skills"
          />
        </h3>
        
        {importOptions.skills && (
          <div className="import-preview__skills">
            {previewData.skills.map((skill: any, index: number) => (
              <span key={index} className="import-preview__skill-tag">
                {detailed && (
                  <Checkbox
                    checked={selectedItems.get(`skill-${index}`) || false}
                    onChange={() => handleItemToggle(`skill-${index}`)}
                    size="small"
                  />
                )}
                {typeof skill === 'string' ? skill : skill.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCertifications = () => {
    if (!previewData?.certifications || previewData.certifications.length === 0) {
      return null;
    }

    return (
      <div className="import-preview__section">
        <h3 className="import-preview__section-title">
          <Checkbox
            checked={importOptions.certifications}
            onChange={() => handleOptionChange('certifications')}
            label="Certifications"
          />
        </h3>
        
        {importOptions.certifications && (
          <div className="import-preview__items">
            {previewData.certifications.map((cert: any, index: number) => (
              <Card key={index} className="import-preview__item">
                {detailed && (
                  <Checkbox
                    checked={selectedItems.get(`cert-${index}`) || false}
                    onChange={() => handleItemToggle(`cert-${index}`)}
                  />
                )}
                <div className="import-preview__item-content">
                  <h4>{cert.name}</h4>
                  <p>{cert.issuingOrganization}</p>
                  {cert.issueDate && (
                    <p className="import-preview__item-date">
                      Issued: {formatDate(cert.issueDate)}
                      {cert.expirationDate && ` • Expires: ${formatDate(cert.expirationDate)}`}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    
    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
    }
    
    if (date.year) {
      const month = date.month ? new Date(date.year, date.month - 1).toLocaleDateString('en-US', { month: 'short' }) : '';
      return `${month} ${date.year}`.trim();
    }
    
    return '';
  };

  if (isLoading) {
    return (
      <div className="import-preview import-preview--loading">
        <Spinner />
        <p>Loading preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="import-preview import-preview--error">
        <Alert type="error" className="alert--error">
          {error}
        </Alert>
        <Button onClick={loadPreview}>Retry</Button>
      </div>
    );
  }

  if (importResult) {
    return (
      <div className="import-preview import-preview--success">
        <Alert type="success">
          Successfully imported:
          <ul>
            {importResult.workExperience && (
              <li>{importResult.workExperience.imported} work experience entries</li>
            )}
            {importResult.education && (
              <li>{importResult.education.imported} education entries</li>
            )}
            {importResult.skills && (
              <li>{importResult.skills.imported} skills</li>
            )}
            {importResult.certifications && (
              <li>{importResult.certifications.imported} certifications</li>
            )}
          </ul>
        </Alert>
        <Button onClick={onCancel || (() => window.location.href = '/profile')}>
          View Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="import-preview">
      <div className="import-preview__header">
        <h2>Import LinkedIn Profile</h2>
        {previewData?.profile && (
          <div className="import-preview__profile">
            <h3>{previewData.profile.localizedFirstName} {previewData.profile.localizedLastName}</h3>
            {previewData.profile.headline && <p>{previewData.profile.headline}</p>}
          </div>
        )}
      </div>

      <div className="import-preview__content">
        {renderWorkExperience()}
        {renderEducation()}
        {renderSkills()}
        {renderCertifications()}

        {previewData?.profile && (
          <div className="import-preview__section">
            <h3>Profile Information</h3>
            <Checkbox
              checked={importOptions.summary}
              onChange={() => handleOptionChange('summary')}
              label="Summary"
            />
            <Checkbox
              checked={importOptions.profilePhoto}
              onChange={() => handleOptionChange('profilePhoto')}
              label="Profile Photo"
            />
            <Checkbox
              checked={importOptions.location}
              onChange={() => handleOptionChange('location')}
              label="Location"
            />
            <Checkbox
              checked={importOptions.industry}
              onChange={() => handleOptionChange('industry')}
              label="Industry"
            />
          </div>
        )}
      </div>

      <div className="import-preview__actions">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isImporting}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleImport}
          disabled={isImporting}
        >
          {isImporting ? 'Importing...' : 'Import Selected'}
        </Button>
      </div>
    </div>
  );
};