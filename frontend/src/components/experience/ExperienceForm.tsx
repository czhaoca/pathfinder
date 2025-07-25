import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Experience } from '@/types/experience';

const experienceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  organization: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  startDate: z.string(),
  endDate: z.string().optional(),
  isCurrent: z.boolean(),
  experienceType: z.enum(['work', 'education', 'volunteer', 'project', 'certification', 'other']),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary']).optional(),
}).refine((data) => {
  if (!data.isCurrent && !data.endDate) {
    return false;
  }
  if (data.isCurrent && data.endDate) {
    return false;
  }
  return true;
}, {
  message: "End date is required for completed experiences",
  path: ["endDate"],
});

type ExperienceFormData = z.infer<typeof experienceSchema>;

interface ExperienceFormProps {
  experience?: Experience;
  onSubmit: (data: ExperienceFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ExperienceForm({ experience, onSubmit, onCancel, isSubmitting }: ExperienceFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ExperienceFormData>({
    resolver: zodResolver(experienceSchema),
    defaultValues: experience ? {
      title: experience.title,
      organization: experience.organization || '',
      department: experience.department || '',
      location: experience.location || '',
      description: experience.description,
      startDate: experience.startDate ? new Date(experience.startDate).toISOString().split('T')[0] : '',
      endDate: experience.endDate ? new Date(experience.endDate).toISOString().split('T')[0] : '',
      isCurrent: experience.isCurrent,
      experienceType: experience.experienceType,
      employmentType: experience.employmentType,
    } : {
      isCurrent: false,
      experienceType: 'work',
    }
  });

  const isCurrent = watch('isCurrent');
  const experienceType = watch('experienceType');

  React.useEffect(() => {
    if (isCurrent) {
      setValue('endDate', '');
    }
  }, [isCurrent, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="e.g., Senior Software Engineer"
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="organization">Organization</Label>
          <Input
            id="organization"
            {...register('organization')}
            placeholder="e.g., Google"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              {...register('department')}
              placeholder="e.g., Engineering"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              {...register('location')}
              placeholder="e.g., San Francisco, CA"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="experienceType">Experience Type *</Label>
          <Select
            value={experienceType}
            onValueChange={(value) => setValue('experienceType', value as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work">Work</SelectItem>
              <SelectItem value="education">Education</SelectItem>
              <SelectItem value="volunteer">Volunteer</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {experienceType === 'work' && (
          <div className="grid gap-2">
            <Label htmlFor="employmentType">Employment Type *</Label>
            <Select
              value={watch('employmentType')}
              onValueChange={(value) => setValue('employmentType', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="freelance">Freelance</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            {...register('description')}
            rows={4}
            placeholder="Describe your responsibilities, achievements, and impact..."
          />
          {errors.description && (
            <p className="text-sm text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input
              id="startDate"
              type="date"
              {...register('startDate')}
            />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="endDate">End Date {!isCurrent && '*'}</Label>
            <Input
              id="endDate"
              type="date"
              {...register('endDate')}
              disabled={isCurrent}
            />
            {errors.endDate && (
              <p className="text-sm text-destructive">{errors.endDate.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isCurrent"
            checked={isCurrent}
            onCheckedChange={(checked) => setValue('isCurrent', checked)}
          />
          <Label htmlFor="isCurrent">Currently working here</Label>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : experience ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}