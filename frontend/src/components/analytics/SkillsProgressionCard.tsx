import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TrendingUp, Award, Clock, Briefcase } from 'lucide-react'
import { SkillProgression, SkillsSummary } from '@/types/analytics'
import { analyticsService } from '@/services/analyticsService'

interface SkillsProgressionCardProps {
  skills: SkillProgression[]
  summary: SkillsSummary
}

export default function SkillsProgressionCard({ skills, summary }: SkillsProgressionCardProps) {
  const getProficiencyLabel = (level: number) => {
    const labels = ['Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']
    return labels[level - 1] || 'Unknown'
  }

  const getProficiencyColor = (level: number) => {
    const colors = [
      'bg-gray-100 text-gray-700',
      'bg-blue-100 text-blue-700',
      'bg-indigo-100 text-indigo-700',
      'bg-purple-100 text-purple-700',
      'bg-green-100 text-green-700'
    ]
    return colors[level - 1] || 'bg-gray-100 text-gray-700'
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      programming: '💻',
      frontend: '🎨',
      backend: '⚙️',
      database: '🗄️',
      cloud: '☁️',
      data: '📊',
      soft: '🤝',
      other: '📌'
    }
    return icons[category] || '📌'
  }

  const topSkills = skills
    .sort((a, b) => b.proficiencyLevel - a.proficiencyLevel || b.evidenceCount - a.evidenceCount)
    .slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Skills Progression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{summary.totalSkills}</div>
            <div className="text-sm text-muted-foreground">Total Skills</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.expertSkills}</div>
            <div className="text-sm text-muted-foreground">Expert Level</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.advancedSkills}</div>
            <div className="text-sm text-muted-foreground">Advanced Level</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {summary.averageProficiency.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Avg Proficiency</div>
          </div>
        </div>

        {/* Skills by Category */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Skills by Category</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.skillsByCategory).map(([category, count]) => (
              <Badge key={category} variant="secondary" className="gap-1">
                <span>{getCategoryIcon(category)}</span>
                <span className="capitalize">{category}</span>
                <span className="font-bold">{count}</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Top Skills List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Top Skills</h4>
          <div className="space-y-3">
            {topSkills.map((skill) => (
              <div key={skill.progressionId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCategoryIcon(skill.skillCategory)}</span>
                    <span className="font-medium">{skill.skillName}</span>
                  </div>
                  <Badge className={getProficiencyColor(skill.proficiencyLevel)}>
                    {getProficiencyLabel(skill.proficiencyLevel)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {analyticsService.formatDuration(skill.totalMonthsUsed)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {skill.evidenceCount} experience{skill.evidenceCount > 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {Math.round(skill.confidenceScore * 100)}% confidence
                  </div>
                </div>

                <Progress 
                  value={skill.proficiencyLevel * 20} 
                  className="h-2"
                />

                {/* Skill Contexts */}
                {skill.contexts.length > 0 && (
                  <div className="text-xs text-muted-foreground pl-6">
                    Used in: {skill.contexts.slice(0, 2).map(ctx => ctx.title).join(', ')}
                    {skill.contexts.length > 2 && ` +${skill.contexts.length - 2} more`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Show More Button */}
        {skills.length > 10 && (
          <div className="text-center pt-2">
            <button className="text-sm text-primary hover:underline">
              View all {skills.length} skills →
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}