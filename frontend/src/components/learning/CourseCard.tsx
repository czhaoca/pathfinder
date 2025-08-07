import { 
  Clock, 
  DollarSign, 
  Star, 
  Users, 
  Award,
  Globe,
  BarChart
} from 'lucide-react'
import type { Course } from '@/services/learningService'

interface CourseCardProps {
  course: Course
  onEnroll: () => void
}

export default function CourseCard({ course, onEnroll }: CourseCardProps) {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-orange-100 text-orange-700',
    expert: 'bg-red-100 text-red-700'
  }

  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      {course.thumbnail_url && (
        <img 
          src={course.thumbnail_url} 
          alt={course.course_name}
          className="w-full h-40 object-cover rounded-lg mb-4"
        />
      )}
      
      <h4 className="font-semibold text-lg mb-2 line-clamp-2">{course.course_name}</h4>
      
      <p className="text-sm text-gray-600 mb-3">{course.provider}</p>
      
      <p className="text-sm text-gray-700 mb-4 line-clamp-3">{course.description}</p>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-gray-500" />
          <span>{course.duration_hours} hours</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <BarChart className="w-4 h-4 text-gray-500" />
          <span className={`px-2 py-1 rounded-full text-xs ${difficultyColors[course.difficulty_level]}`}>
            {course.difficulty_level}
          </span>
        </div>
        
        {course.price_usd !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span>{course.price_usd === 0 ? 'Free' : `$${course.price_usd}`}</span>
          </div>
        )}
        
        {course.rating && (
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span>{course.rating.toFixed(1)}</span>
            {course.rating_count && (
              <span className="text-gray-500">({course.rating_count})</span>
            )}
          </div>
        )}
        
        {course.enrolled_count && course.enrolled_count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-500" />
            <span>{course.enrolled_count.toLocaleString()} enrolled</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm">
          <Globe className="w-4 h-4 text-gray-500" />
          <span>{course.language}</span>
        </div>
        
        {course.has_certificate && (
          <div className="flex items-center gap-2 text-sm">
            <Award className="w-4 h-4 text-green-500" />
            <span className="text-green-700">Certificate available</span>
          </div>
        )}
      </div>
      
      {course.skills_covered && course.skills_covered.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Skills:</p>
          <div className="flex flex-wrap gap-1">
            {course.skills_covered.slice(0, 3).map((skill, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {skill}
              </span>
            ))}
            {course.skills_covered.length > 3 && (
              <span className="px-2 py-1 text-gray-500 text-xs">
                +{course.skills_covered.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={onEnroll}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Enroll
        </button>
        {course.course_url && (
          <a
            href={course.course_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View →
          </a>
        )}
      </div>
    </div>
  )
}