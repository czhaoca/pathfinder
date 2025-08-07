import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { 
  MessageSquare, 
  Star, 
  ChevronRight, 
  Save,
  Edit,
  Plus,
  Lightbulb,
  Target,
  Brain,
  Clock,
  Building
} from 'lucide-react'
import { toast } from 'sonner'
import jobSearchService from '@/services/jobSearchService'
import type { 
  InterviewQuestion, 
  InterviewResponse, 
  InterviewPrep,
  JobApplication 
} from '@/services/jobSearchService'

export default function InterviewPrepPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const [prep, setPrep] = useState<InterviewPrep | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null)
  const [responseText, setResponseText] = useState('')
  const [selfRating, setSelfRating] = useState(3)
  const [needsImprovement, setNeedsImprovement] = useState(false)
  const [userResponses, setUserResponses] = useState<InterviewResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'questions' | 'responses' | 'tips'>('questions')
  const [questionFilter, setQuestionFilter] = useState<'all' | 'behavioral' | 'technical' | 'situational'>('all')

  useEffect(() => {
    if (applicationId) {
      loadInterviewPrep()
    } else {
      loadGeneralQuestions()
    }
    loadUserResponses()
  }, [applicationId])

  const loadInterviewPrep = async () => {
    if (!applicationId) return
    
    setLoading(true)
    try {
      const prepData = await jobSearchService.getApplicationInterviewPrep(applicationId)
      setPrep(prepData)
    } catch (error) {
      console.error('Error loading interview prep:', error)
      toast.error('Failed to load interview preparation')
    } finally {
      setLoading(false)
    }
  }

  const loadGeneralQuestions = async () => {
    setLoading(true)
    try {
      const questions = await jobSearchService.getInterviewQuestions({ limit: 50 })
      setPrep({
        application_id: '',
        company_name: 'General Practice',
        role_title: 'Various Roles',
        questions,
        responses: [],
        tips: [
          'Use the STAR method for behavioral questions',
          'Research the company thoroughly',
          'Prepare specific examples from your experience',
          'Practice your answers out loud',
          'Prepare thoughtful questions to ask the interviewer'
        ]
      })
    } catch (error) {
      console.error('Error loading questions:', error)
      toast.error('Failed to load interview questions')
    } finally {
      setLoading(false)
    }
  }

  const loadUserResponses = async () => {
    try {
      const responses = await jobSearchService.getUserResponses({ limit: 100 })
      setUserResponses(responses)
    } catch (error) {
      console.error('Error loading responses:', error)
    }
  }

  const handleSaveResponse = async () => {
    if (!selectedQuestion || !responseText.trim()) {
      toast.error('Please select a question and provide a response')
      return
    }

    try {
      const response = await jobSearchService.saveInterviewResponse({
        prepId: selectedQuestion.id,
        responseText,
        selfRating,
        needsImprovement,
        requestFeedback: needsImprovement
      })
      
      setUserResponses([response, ...userResponses])
      toast.success('Response saved successfully')
      
      // Clear form
      setResponseText('')
      setSelfRating(3)
      setNeedsImprovement(false)
    } catch (error) {
      console.error('Error saving response:', error)
      toast.error('Failed to save response')
    }
  }

  const filteredQuestions = prep?.questions.filter(q => 
    questionFilter === 'all' || q.question_type === questionFilter
  ) || []

  const questionTypeColors = {
    behavioral: 'bg-blue-100 text-blue-700',
    technical: 'bg-purple-100 text-purple-700',
    situational: 'bg-green-100 text-green-700'
  }

  const difficultyColors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700'
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Preparation</h1>
        {prep && (
          <div className="flex items-center gap-4 text-gray-600">
            {prep.company_name !== 'General Practice' && (
              <>
                <span className="flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  {prep.company_name}
                </span>
                <span>•</span>
              </>
            )}
            <span>{prep.role_title}</span>
            {prep.interview_date && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(prep.interview_date).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'questions'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <MessageSquare className="inline-block w-4 h-4 mr-2" />
          Questions ({filteredQuestions.length})
        </button>
        <button
          onClick={() => setActiveTab('responses')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'responses'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Edit className="inline-block w-4 h-4 mr-2" />
          My Responses ({userResponses.length})
        </button>
        <button
          onClick={() => setActiveTab('tips')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'tips'
              ? 'text-blue-600 border-blue-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
          }`}
        >
          <Lightbulb className="inline-block w-4 h-4 mr-2" />
          Tips & Insights
        </button>
      </div>

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Questions List */}
          <div>
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setQuestionFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  questionFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setQuestionFilter('behavioral')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  questionFilter === 'behavioral' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                Behavioral
              </button>
              <button
                onClick={() => setQuestionFilter('technical')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  questionFilter === 'technical' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                Technical
              </button>
              <button
                onClick={() => setQuestionFilter('situational')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  questionFilter === 'situational' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                Situational
              </button>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredQuestions.map((question) => (
                <div
                  key={question.id}
                  onClick={() => setSelectedQuestion(question)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedQuestion?.id === question.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium mb-2">{question.question_text}</p>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      questionTypeColors[question.question_type]
                    }`}>
                      {question.question_type}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      difficultyColors[question.difficulty_level]
                    }`}>
                      {question.difficulty_level}
                    </span>
                    {question.company_name && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                        {question.company_name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Response Editor */}
          <div className="border rounded-lg p-6">
            {selectedQuestion ? (
              <>
                <h3 className="font-semibold mb-4">Practice Your Response</h3>
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium mb-2">{selectedQuestion.question_text}</p>
                  {selectedQuestion.answer_framework && (
                    <div className="mt-3 p-3 bg-blue-50 rounded">
                      <p className="text-sm font-medium text-blue-900 mb-1">Framework:</p>
                      <p className="text-sm text-blue-700">{selectedQuestion.answer_framework}</p>
                    </div>
                  )}
                  {selectedQuestion.tips && (
                    <div className="mt-3 p-3 bg-yellow-50 rounded">
                      <p className="text-sm font-medium text-yellow-900 mb-1">Tips:</p>
                      <p className="text-sm text-yellow-700">{selectedQuestion.tips}</p>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Response
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Write your response here..."
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Self Rating
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setSelfRating(rating)}
                        className="p-2"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            rating <= selfRating
                              ? 'text-yellow-500 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={needsImprovement}
                      onChange={(e) => setNeedsImprovement(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Mark for improvement
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleSaveResponse}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Response
                </button>

                {selectedQuestion.sample_answer && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
                      View Sample Answer
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                      {selectedQuestion.sample_answer}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a question to practice your response</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          {userResponses.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Edit className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No saved responses yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Practice answering questions and save your responses for review
              </p>
            </div>
          ) : (
            userResponses.map((response) => (
              <div key={response.id} className="border rounded-lg p-4">
                <div className="mb-3">
                  <p className="font-medium">{response.question_text}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < (response.self_rating || 0)
                              ? 'text-yellow-500 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    {response.needs_improvement && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                        Needs Improvement
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {new Date(response.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-sm whitespace-pre-wrap">{response.response_text}</p>
                </div>
                {response.feedback && (
                  <div className="mt-3 p-3 bg-blue-50 rounded">
                    <p className="text-sm font-medium text-blue-900 mb-1">Feedback:</p>
                    <p className="text-sm text-blue-700">{response.feedback}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tips Tab */}
      {activeTab === 'tips' && prep && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              General Interview Tips
            </h3>
            <div className="space-y-3">
              {prep.tips.map((tip, index) => (
                <div key={index} className="flex gap-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {prep.company_insights && (
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building className="w-5 h-5" />
                Company Insights
              </h3>
              <div className="space-y-4">
                {prep.company_insights.culture && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Culture</h4>
                    <p className="text-sm text-gray-600">{prep.company_insights.culture}</p>
                  </div>
                )}
                {prep.company_insights.interview_process && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Interview Process</h4>
                    <p className="text-sm text-gray-600">{prep.company_insights.interview_process}</p>
                  </div>
                )}
                {prep.company_insights.common_questions && prep.company_insights.common_questions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">Common Questions</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {prep.company_insights.common_questions.map((q, i) => (
                        <li key={i} className="flex gap-2">
                          <span>•</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}