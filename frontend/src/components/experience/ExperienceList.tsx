import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Building2, Edit, Trash2 } from 'lucide-react';
import { Experience } from '@/types/experience';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';

interface ExperienceListProps {
  experiences: Experience[];
  loading?: boolean;
  error?: string | null;
  onEdit?: (experience: Experience) => void;
  onDelete?: (experience: Experience) => void;
  onAdd?: () => void;
  onRetry?: () => void;
}

export function ExperienceList({
  experiences,
  loading,
  error,
  onEdit,
  onDelete,
  onAdd,
  onRetry
}: ExperienceListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner message="Loading experiences..." />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load experiences"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (experiences.length === 0) {
    return (
      <EmptyState
        icon={Building2}
        title="No experiences yet"
        description="Start building your professional profile by adding your work experience, education, and achievements."
        action={onAdd ? {
          label: "Add Experience",
          onClick: onAdd
        } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      {experiences.map((experience) => (
        <ExperienceCard
          key={experience.experienceId}
          experience={experience}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface ExperienceCardProps {
  experience: Experience;
  onEdit?: (experience: Experience) => void;
  onDelete?: (experience: Experience) => void;
}

function ExperienceCard({ experience, onEdit, onDelete }: ExperienceCardProps) {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  const duration = experience.isCurrent
    ? `${formatDate(experience.startDate)} - Present`
    : `${formatDate(experience.startDate)} - ${experience.endDate ? formatDate(experience.endDate) : ''}`;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{experience.title}</h3>
              {experience.organization && (
                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{experience.organization}</span>
                  {experience.department && (
                    <span>• {experience.department}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(experience)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(experience)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{duration}</span>
            </div>
            {experience.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{experience.location}</span>
              </div>
            )}
          </div>

          {experience.description && (
            <p className="mt-4 text-sm whitespace-pre-wrap">{experience.description}</p>
          )}

          {experience.extractedSkills && experience.extractedSkills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {experience.extractedSkills.map((skill, index) => (
                <Badge key={index} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          )}

          {experience.keyHighlights && experience.keyHighlights.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Key Highlights:</p>
              <ul className="list-disc list-inside space-y-1">
                {experience.keyHighlights.map((highlight, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}