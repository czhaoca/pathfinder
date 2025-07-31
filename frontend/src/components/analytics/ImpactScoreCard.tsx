import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Lightbulb, 
  Target,
  AlertCircle
} from 'lucide-react'
import { ImpactScores, ImpactSuggestion } from '@/types/analytics'

interface ImpactScoreCardProps {
  scores: ImpactScores
  suggestions?: ImpactSuggestion[]
  experienceTitle?: string
}

export default function ImpactScoreCard({ scores, suggestions, experienceTitle }: ImpactScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50'
    if (score >= 0.6) return 'text-blue-600 bg-blue-50'
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent'
    if (score >= 0.6) return 'Strong'
    if (score >= 0.4) return 'Moderate'
    if (score >= 0.2) return 'Limited'
    return 'Minimal'
  }

  const scoreItems = [
    {
      category: 'Revenue Impact',
      score: scores.revenue,
      icon: DollarSign,
      description: 'Direct contribution to revenue growth or cost savings'
    },
    {
      category: 'Efficiency Gains',
      score: scores.efficiency,
      icon: TrendingUp,
      description: 'Process improvements and time savings'
    },
    {
      category: 'Team Growth',
      score: scores.teamGrowth,
      icon: Users,
      description: 'Leadership and team development impact'
    },
    {
      category: 'Innovation',
      score: scores.innovation,
      icon: Lightbulb,
      description: 'New solutions and creative contributions'
    }
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Impact Scores
            {experienceTitle && (
              <span className="text-sm font-normal text-muted-foreground">
                for {experienceTitle}
              </span>
            )}
          </CardTitle>
          <Badge className={getScoreColor(scores.overall)}>
            Overall: {Math.round(scores.overall * 100)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Impact Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Impact</span>
            <span className={`font-semibold ${getScoreColor(scores.overall).split(' ')[0]}`}>
              {getScoreLabel(scores.overall)}
            </span>
          </div>
          <Progress 
            value={scores.overall * 100} 
            className="h-3"
          />
        </div>

        {/* Individual Impact Categories */}
        <div className="grid gap-4">
          {scoreItems.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.category} className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${getScoreColor(item.score)}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{item.category}</h4>
                      <span className="text-sm font-semibold">
                        {Math.round(item.score * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    <Progress 
                      value={item.score * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Impact Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Suggestions to Improve Impact
            </h4>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index} 
                  className="p-3 rounded-lg bg-blue-50 border border-blue-200"
                >
                  <p className="text-sm font-medium text-blue-900">
                    {suggestion.category}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {suggestion.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Impact Score Legend */}
        <div className="pt-4 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Impact Score Guide</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>80-100%: Excellent Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>60-79%: Strong Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>40-59%: Moderate Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span>0-39%: Limited Impact</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}