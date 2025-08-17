/**
 * Profile Completion Indicator Component
 * Shows visual progress of profile completion with interactive elements
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../../stores/profileStore';
import './ProfileCompletionIndicator.css';

interface CompletionStats {
  totalFields: number;
  completedFields: number;
  requiredFields: number;
  completedRequired: number;
  completionPercentage: number;
  profileScore: number;
  breakdown?: {
    essential: {
      total: number;
      completed: number;
      percentage: number;
    };
    professional: {
      total: number;
      completed: number;
      percentage: number;
    };
    optional: {
      total: number;
      completed: number;
      percentage: number;
    };
  };
}

interface Props {
  showDetails?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  className?: string;
}

export const ProfileCompletionIndicator: React.FC<Props> = ({
  showDetails = true,
  size = 'medium',
  onClick,
  className = ''
}) => {
  const navigate = useNavigate();
  const { getCompletionStats } = useProfileStore();
  const [stats, setStats] = useState<CompletionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadCompletionStats();
  }, []);

  const loadCompletionStats = async () => {
    try {
      setLoading(true);
      const completionStats = await getCompletionStats();
      setStats(completionStats);
    } catch (error) {
      console.error('Failed to load completion stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/profile/edit');
    }
  };

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return '#10b981'; // Green
    if (percentage >= 60) return '#f59e0b'; // Yellow
    if (percentage >= 40) return '#3b82f6'; // Blue
    return '#ef4444'; // Red
  };

  const getCompletionMessage = (percentage: number) => {
    if (percentage === 100) return 'Profile Complete!';
    if (percentage >= 80) return 'Almost there!';
    if (percentage >= 60) return 'Good progress';
    if (percentage >= 40) return 'Keep going';
    return 'Get started';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  };

  if (loading) {
    return (
      <div className={`profile-completion-indicator ${size} ${className} loading`}>
        <div className="skeleton-loader">
          <div className="skeleton-circle" />
          <div className="skeleton-text" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const percentage = Math.round(stats.completionPercentage || 0);
  const color = getCompletionColor(percentage);
  const message = getCompletionMessage(percentage);
  const radius = size === 'small' ? 30 : size === 'large' ? 60 : 45;
  const strokeWidth = size === 'small' ? 3 : size === 'large' ? 5 : 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className={`profile-completion-indicator ${size} ${className} ${expanded ? 'expanded' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Profile ${percentage}% complete. Click to edit profile.`}
    >
      <div className="completion-main">
        <div className="completion-circle">
          <svg 
            width={(radius + strokeWidth) * 2} 
            height={(radius + strokeWidth) * 2}
            className="progress-ring"
          >
            {/* Background circle */}
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${radius + strokeWidth} ${radius + strokeWidth})`}
              className="progress-ring-circle"
            />
          </svg>
          <div className="percentage-text">
            <span className="percentage-value">{percentage}</span>
            <span className="percentage-symbol">%</span>
          </div>
        </div>

        {showDetails && (
          <div className="completion-details">
            <p className="completion-message">{message}</p>
            <p className="completion-fields">
              {stats.completedFields} of {stats.totalFields} fields complete
            </p>
            {stats.profileScore !== undefined && (
              <div className="profile-score">
                <span className="score-label">Profile Score:</span>
                <span className="score-value">{stats.profileScore}/100</span>
                <span className="score-grade">({getScoreGrade(stats.profileScore)})</span>
              </div>
            )}
            {size !== 'small' && (
              <button 
                className="expand-toggle"
                onClick={toggleExpanded}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide details' : 'Show details'}
              >
                {expanded ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && stats.breakdown && (
        <div className="completion-breakdown">
          <h4>Profile Breakdown</h4>
          
          <div className="breakdown-category">
            <div className="category-header">
              <span className="category-name">Essential Fields</span>
              <span className="category-progress">
                {stats.breakdown.essential.completed}/{stats.breakdown.essential.total}
              </span>
            </div>
            <div className="category-bar">
              <div 
                className="category-fill essential"
                style={{ width: `${stats.breakdown.essential.percentage}%` }}
              />
            </div>
          </div>

          <div className="breakdown-category">
            <div className="category-header">
              <span className="category-name">Professional Info</span>
              <span className="category-progress">
                {stats.breakdown.professional.completed}/{stats.breakdown.professional.total}
              </span>
            </div>
            <div className="category-bar">
              <div 
                className="category-fill professional"
                style={{ width: `${stats.breakdown.professional.percentage}%` }}
              />
            </div>
          </div>

          <div className="breakdown-category">
            <div className="category-header">
              <span className="category-name">Optional Fields</span>
              <span className="category-progress">
                {stats.breakdown.optional.completed}/{stats.breakdown.optional.total}
              </span>
            </div>
            <div className="category-bar">
              <div 
                className="category-fill optional"
                style={{ width: `${stats.breakdown.optional.percentage}%` }}
              />
            </div>
          </div>

          {stats.completedRequired < stats.requiredFields && (
            <div className="missing-required-alert">
              <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>
                {stats.requiredFields - stats.completedRequired} required field{stats.requiredFields - stats.completedRequired !== 1 ? 's' : ''} missing
              </span>
            </div>
          )}

          <button className="complete-profile-btn">
            Complete Your Profile
          </button>
        </div>
      )}
    </div>
  );
};