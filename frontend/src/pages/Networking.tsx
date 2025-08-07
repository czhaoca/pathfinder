import { useState, useEffect } from 'react'
import { 
  Users, 
  UserPlus, 
  Calendar, 
  Bell, 
  MessageSquare,
  Search,
  Filter,
  BarChart3,
  Clock,
  TrendingUp,
  Mail
} from 'lucide-react'
import { toast } from 'sonner'
import networkingService from '@/services/networkingService'
import type { 
  Contact, 
  ContactAnalytics, 
  Reminder,
  NetworkingRecommendation,
  NetworkingInsights 
} from '@/services/networkingService'
import { authStore } from '@/stores/authStore'
import ContactsList from '@/components/networking/ContactsList'
import ContactDetails from '@/components/networking/ContactDetails'
import NetworkingRecommendations from '@/components/networking/NetworkingRecommendations'
import RemindersPanel from '@/components/networking/RemindersPanel'
import NetworkInsights from '@/components/networking/NetworkInsights'

export default function Networking() {
  const { user } = authStore()
  const [activeTab, setActiveTab] = useState<'contacts' | 'recommendations' | 'reminders' | 'insights'>('contacts')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [analytics, setAnalytics] = useState<ContactAnalytics | null>(null)
  const [recommendations, setRecommendations] = useState<NetworkingRecommendation[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [insights, setInsights] = useState<NetworkingInsights | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      // Load contacts and analytics
      const [contactsData, analyticsData, upcomingReminders] = await Promise.all([
        networkingService.listContacts(),
        networkingService.getContactAnalytics(),
        networkingService.getUpcomingReminders(7)
      ])
      
      setContacts(contactsData)
      setAnalytics(analyticsData)
      setReminders(upcomingReminders)

      // Load recommendations and insights for the active tab
      if (activeTab === 'recommendations') {
        const recs = await networkingService.getRecommendations()
        setRecommendations(recs)
      } else if (activeTab === 'insights') {
        const insightsData = await networkingService.getNetworkingInsights()
        setInsights(insightsData)
      }
    } catch (error) {
      console.error('Error loading networking data:', error)
      toast.error('Failed to load networking data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadInitialData()
      return
    }

    setLoading(true)
    try {
      const results = await networkingService.searchContacts(searchQuery)
      setContacts(results)
    } catch (error) {
      console.error('Error searching contacts:', error)
      toast.error('Failed to search contacts')
    } finally {
      setLoading(false)
    }
  }

  const handleAddContact = async (contactData: Omit<Contact, 'contact_id' | 'user_id' | 'created_at'>) => {
    try {
      const newContact = await networkingService.createContact(contactData)
      setContacts([newContact, ...contacts])
      setShowAddContact(false)
      toast.success('Contact added successfully!')
    } catch (error) {
      console.error('Error adding contact:', error)
      toast.error('Failed to add contact')
    }
  }

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      await networkingService.deleteContact(contactId)
      setContacts(contacts.filter(c => c.contact_id !== contactId))
      setSelectedContact(null)
      toast.success('Contact deleted successfully')
    } catch (error) {
      console.error('Error deleting contact:', error)
      toast.error('Failed to delete contact')
    }
  }

  const tabContent = {
    contacts: (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ContactsList 
            contacts={contacts}
            selectedContact={selectedContact}
            onSelectContact={setSelectedContact}
            onAddContact={() => setShowAddContact(true)}
            onDeleteContact={handleDeleteContact}
            showAddModal={showAddContact}
            onCloseAddModal={() => setShowAddContact(false)}
            onSaveNewContact={handleAddContact}
          />
        </div>
        <div className="lg:col-span-1">
          {selectedContact ? (
            <ContactDetails 
              contact={selectedContact}
              onUpdate={(updates) => {
                networkingService.updateContact(selectedContact.contact_id, updates)
                  .then(() => {
                    loadInitialData()
                    toast.success('Contact updated')
                  })
                  .catch(() => toast.error('Failed to update contact'))
              }}
              onLogInteraction={(interaction) => {
                networkingService.logInteraction({
                  ...interaction,
                  contact_id: selectedContact.contact_id
                }).then(() => {
                  toast.success('Interaction logged')
                  loadInitialData()
                }).catch(() => toast.error('Failed to log interaction'))
              }}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center text-gray-500 py-12">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Select a contact to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    recommendations: (
      <NetworkingRecommendations 
        recommendations={recommendations}
        onDismiss={(id) => {
          networkingService.dismissRecommendation(id).then(() => {
            setRecommendations(recommendations.filter(r => r.recommendation_id !== id))
            toast.success('Recommendation dismissed')
          })
        }}
        onAction={(recommendation) => {
          // Handle recommendation action based on type
          if (recommendation.type === 'follow_up' && recommendation.contact_id) {
            setSelectedContact(contacts.find(c => c.contact_id === recommendation.contact_id) || null)
            setActiveTab('contacts')
          }
        }}
      />
    ),
    reminders: (
      <RemindersPanel 
        reminders={reminders}
        onCompleteReminder={(id) => {
          networkingService.completeReminder(id).then(() => {
            setReminders(reminders.map(r => 
              r.reminder_id === id ? { ...r, status: 'completed' as const } : r
            ))
            toast.success('Reminder completed')
          })
        }}
        onUpdateReminder={(id, updates) => {
          networkingService.updateReminder(id, updates).then(() => {
            loadInitialData()
            toast.success('Reminder updated')
          })
        }}
        onCreateReminder={(reminder) => {
          networkingService.createReminder(reminder).then(() => {
            loadInitialData()
            toast.success('Reminder created')
          })
        }}
      />
    ),
    insights: (
      <NetworkInsights 
        insights={insights}
        analytics={analytics}
        onRefresh={loadInitialData}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Professional Networking</h1>
            <p className="text-gray-600 mt-1">
              Manage your professional connections and build meaningful relationships
            </p>
          </div>
          <button
            onClick={loadInitialData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contacts by name, company, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'contacts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Contacts
              {analytics && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                  {analytics.total_contacts}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('recommendations')
                if (recommendations.length === 0) {
                  networkingService.getRecommendations().then(setRecommendations)
                }
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'recommendations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Recommendations
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reminders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Bell className="w-4 h-4 inline mr-2" />
              Reminders
              {reminders.filter(r => r.status === 'pending').length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  {reminders.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('insights')
                if (!insights) {
                  networkingService.getNetworkingInsights().then(setInsights)
                }
              }}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'insights'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              Insights
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        tabContent[activeTab]
      )}

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Contacts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.total_contacts}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recent Interactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.recent_interactions}
                </p>
              </div>
              <MessageSquare className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Follow-ups</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.overdue_followups}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Relationship</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.average_relationship_strength.toFixed(1)}/5
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}