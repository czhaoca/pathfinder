import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Dot
} from 'recharts'
import { TrendingUp, Briefcase, Award, ArrowRight } from 'lucide-react'
import { CareerTrajectory, CareerMilestone, TimelineEntry } from '@/types/analytics'
import { analyticsService } from '@/services/analyticsService'

interface CareerTrajectoryChartProps {
  trajectory: CareerTrajectory
}

export default function CareerTrajectoryChart({ trajectory }: CareerTrajectoryChartProps) {
  const chartData = useMemo(() => {
    return trajectory.timeline.map((entry, index) => {
      const startDate = new Date(entry.startDate)
      const endDate = entry.endDate === 'Present' ? new Date() : new Date(entry.endDate)
      const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2)
      
      return {
        date: midDate,
        dateLabel: midDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        level: entry.level,
        title: entry.title,
        organization: entry.organization,
        skills: entry.skills.length,
        type: entry.type,
        isMilestone: trajectory.milestones.some(m => 
          m.relatedExperiences.includes(entry.experienceId)
        )
      }
    })
  }, [trajectory])

  const getSeniorityLabel = (level: number) => {
    const labels = ['Entry', 'Junior', 'Mid-Level', 'Senior', 'Leadership']
    return labels[level - 1] || 'Unknown'
  }

  const getVelocityLabel = (velocity: number) => {
    if (velocity >= 0.8) return { label: 'Rapid', color: 'text-green-600' }
    if (velocity >= 0.5) return { label: 'Strong', color: 'text-blue-600' }
    if (velocity >= 0.3) return { label: 'Steady', color: 'text-yellow-600' }
    return { label: 'Gradual', color: 'text-gray-600' }
  }

  const velocityInfo = getVelocityLabel(trajectory.careerVelocity)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.title}</p>
          <p className="text-sm text-muted-foreground">{data.organization}</p>
          <p className="text-sm mt-1">
            Level: <span className="font-medium">{getSeniorityLabel(data.level)}</span>
          </p>
          <p className="text-sm">
            Skills: <span className="font-medium">{data.skills}</span>
          </p>
        </div>
      )
    }
    return null
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    if (payload.isMilestone) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={8} fill="#3B82F6" stroke="#fff" strokeWidth={2} />
          <Award className="h-3 w-3" x={cx - 6} y={cy - 6} fill="#fff" />
        </g>
      )
    }
    return <circle cx={cx} cy={cy} r={5} fill="#3B82F6" />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Career Trajectory
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Career Velocity:</span>
            <Badge className={velocityInfo.color}>
              {velocityInfo.label} ({trajectory.careerVelocity.toFixed(2)})
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Career Progression Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dateLabel" 
                className="text-xs"
                tick={{ fill: '#6B7280' }}
              />
              <YAxis 
                domain={[0, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tickFormatter={getSeniorityLabel}
                className="text-xs"
                tick={{ fill: '#6B7280' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="level" 
                stroke="#3B82F6" 
                strokeWidth={2}
                dot={<CustomDot />}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Key Milestones */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Key Milestones</h4>
          <div className="space-y-2">
            {trajectory.milestones
              .sort((a, b) => new Date(b.milestoneDate).getTime() - new Date(a.milestoneDate).getTime())
              .slice(0, 5)
              .map((milestone) => (
                <div key={milestone.milestoneId} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className={`p-2 rounded-full ${
                    milestone.milestoneType === 'achievement' ? 'bg-green-100' :
                    milestone.milestoneType === 'role_change' ? 'bg-blue-100' :
                    'bg-purple-100'
                  }`}>
                    {milestone.milestoneType === 'achievement' ? (
                      <Award className="h-4 w-4 text-green-600" />
                    ) : (
                      <Briefcase className="h-4 w-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{milestone.title}</p>
                    {milestone.description && (
                      <p className="text-xs text-muted-foreground">{milestone.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {analyticsService.formatDate(milestone.milestoneDate)}
                      {milestone.organization && ` • ${milestone.organization}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Impact: {Math.round(milestone.impactScore * 100)}%
                  </Badge>
                </div>
              ))}
          </div>
        </div>

        {/* Career Transitions */}
        {trajectory.transitions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Career Transitions</h4>
            <div className="space-y-2">
              {trajectory.transitions.map((transition, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{transition.from.title}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">{transition.to.title}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ({transition.type.replace('_', ' ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projected Career Path */}
        {trajectory.projectedPath.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Projected Career Path</h4>
            <div className="space-y-3">
              {trajectory.projectedPath.map((projection, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{projection.timeframe}</span>
                    <Badge variant="secondary">
                      {Math.round(projection.probability * 100)}% probability
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Possible roles: {projection.possibleRoles.join(', ')}
                  </div>
                  {projection.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {projection.requiredSkills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}