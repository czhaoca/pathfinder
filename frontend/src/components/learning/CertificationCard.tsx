import { 
  Award, 
  Building, 
  DollarSign, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ExternalLink
} from 'lucide-react'
import type { Certification, UserCertification } from '@/services/learningService'

interface CertificationCardProps {
  certification: Certification | UserCertification
  isUserCert?: boolean
}

export default function CertificationCard({ certification, isUserCert }: CertificationCardProps) {
  const levelColors = {
    foundational: 'bg-blue-100 text-blue-700',
    associate: 'bg-green-100 text-green-700',
    professional: 'bg-purple-100 text-purple-700',
    expert: 'bg-red-100 text-red-700'
  }

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    revoked: 'bg-gray-100 text-gray-700',
    renewing: 'bg-yellow-100 text-yellow-700'
  }

  const isUserCertification = (cert: any): cert is UserCertification => {
    return 'certification_id' in cert
  }

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return null
    const days = Math.floor((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days < 0) return { text: 'Expired', color: 'text-red-600' }
    if (days < 90) return { text: `Expires in ${days} days`, color: 'text-yellow-600' }
    return { text: `Valid until ${new Date(expiryDate).toLocaleDateString()}`, color: 'text-green-600' }
  }

  if (isUserCert && isUserCertification(certification)) {
    const expiryStatus = getExpiryStatus(certification.expiry_date)
    
    return (
      <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <Award className="w-8 h-8 text-blue-600" />
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            statusColors[certification.status]
          }`}>
            {certification.status}
          </span>
        </div>
        
        <h4 className="font-semibold text-lg mb-2">{certification.certification_name}</h4>
        <p className="text-sm text-gray-600 mb-3">{certification.organization}</p>
        
        {certification.credential_number && (
          <p className="text-xs text-gray-500 mb-2">
            Credential: {certification.credential_number}
          </p>
        )}
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>Issued: {new Date(certification.issue_date).toLocaleDateString()}</span>
          </div>
          
          {expiryStatus && (
            <div className={`flex items-center gap-2 text-sm ${expiryStatus.color}`}>
              {expiryStatus.text.includes('Expired') ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              <span>{expiryStatus.text}</span>
            </div>
          )}
          
          {certification.cpe_credits_earned && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>{certification.cpe_credits_earned} CPE credits earned</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {certification.verification_url && (
            <a
              href={certification.verification_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-center gap-1"
            >
              Verify
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {certification.status === 'active' && certification.expiry_date && (
            <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              Renew
            </button>
          )}
        </div>
      </div>
    )
  }

  // Regular Certification Card
  const cert = certification as Certification
  
  return (
    <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <Award className="w-8 h-8 text-blue-600" />
        {cert.level && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            levelColors[cert.level]
          }`}>
            {cert.level}
          </span>
        )}
      </div>
      
      <h4 className="font-semibold text-lg mb-2 line-clamp-2">{cert.certification_name}</h4>
      
      <div className="flex items-center gap-2 mb-3">
        <Building className="w-4 h-4 text-gray-500" />
        <p className="text-sm text-gray-600">{cert.organization}</p>
      </div>
      
      {cert.description && (
        <p className="text-sm text-gray-700 mb-4 line-clamp-3">{cert.description}</p>
      )}
      
      <div className="space-y-2 mb-4">
        {cert.cost_usd !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span>${cert.cost_usd}</span>
          </div>
        )}
        
        {cert.market_demand_score && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span>Market Demand: {(cert.market_demand_score * 20).toFixed(0)}%</span>
          </div>
        )}
        
        {cert.average_salary_impact && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span>+${(cert.average_salary_impact / 1000).toFixed(0)}k salary impact</span>
          </div>
        )}
        
        {cert.preparation_hours_required && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-500" />
            <span>{cert.preparation_hours_required} hours prep</span>
          </div>
        )}
        
        {cert.renewal_period_years && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>Renew every {cert.renewal_period_years} years</span>
          </div>
        )}
      </div>
      
      {cert.skills_validated && cert.skills_validated.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Skills Validated:</p>
          <div className="flex flex-wrap gap-1">
            {cert.skills_validated.slice(0, 3).map((skill, index) => (
              <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {skill}
              </span>
            ))}
            {cert.skills_validated.length > 3 && (
              <span className="px-2 py-1 text-gray-500 text-xs">
                +{cert.skills_validated.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        {cert.website_url && (
          <a
            href={cert.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center justify-center gap-1"
          >
            Learn More
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {cert.exam_guide_url && (
          <a
            href={cert.exam_guide_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center justify-center gap-1"
          >
            Exam Guide
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}