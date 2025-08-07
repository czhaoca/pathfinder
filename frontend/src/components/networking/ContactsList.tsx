import { useState } from 'react'
import { 
  User, 
  Plus, 
  Search, 
  Building, 
  Mail, 
  Phone,
  Linkedin,
  Tag,
  Star,
  MoreVertical,
  Trash2,
  Edit
} from 'lucide-react'
import type { Contact } from '@/services/networkingService'

interface Props {
  contacts: Contact[]
  selectedContact: Contact | null
  onSelectContact: (contact: Contact) => void
  onAddContact: () => void
  onDeleteContact: (contactId: string) => void
  showAddModal: boolean
  onCloseAddModal: () => void
  onSaveNewContact: (contact: Omit<Contact, 'contact_id' | 'user_id' | 'created_at'>) => void
}

export default function ContactsList({
  contacts,
  selectedContact,
  onSelectContact,
  onAddContact,
  onDeleteContact,
  showAddModal,
  onCloseAddModal,
  onSaveNewContact
}: Props) {
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('name')
  const [newContact, setNewContact] = useState<Partial<Contact>>({})
  const [showMenu, setShowMenu] = useState<string | null>(null)

  const filteredContacts = contacts.filter(contact => {
    if (filterType === 'all') return true
    return contact.relationship_type === filterType
  })

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      case 'company':
        return (a.current_company || '').localeCompare(b.current_company || '')
      case 'recent':
        return (b.last_interaction || '').localeCompare(a.last_interaction || '')
      case 'strength':
        return (b.relationship_strength || 0) - (a.relationship_strength || 0)
      default:
        return 0
    }
  })

  const getRelationshipColor = (type?: string) => {
    switch (type) {
      case 'mentor':
        return 'bg-purple-100 text-purple-700'
      case 'peer':
        return 'bg-blue-100 text-blue-700'
      case 'report':
        return 'bg-green-100 text-green-700'
      case 'recruiter':
        return 'bg-yellow-100 text-yellow-700'
      case 'friend':
        return 'bg-pink-100 text-pink-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Contacts</h3>
          <button
            onClick={onAddContact}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>

        <div className="flex gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="mentor">Mentors</option>
            <option value="peer">Peers</option>
            <option value="report">Reports</option>
            <option value="recruiter">Recruiters</option>
            <option value="friend">Friends</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="company">Sort by Company</option>
            <option value="recent">Most Recent</option>
            <option value="strength">Relationship Strength</option>
          </select>
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        {sortedContacts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No contacts found</p>
            <button
              onClick={onAddContact}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first contact
            </button>
          </div>
        ) : (
          sortedContacts.map((contact) => (
            <div
              key={contact.contact_id}
              className={`p-4 hover:bg-gray-50 cursor-pointer flex items-start justify-between ${
                selectedContact?.contact_id === contact.contact_id ? 'bg-blue-50' : ''
              }`}
              onClick={() => onSelectContact(contact)}
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                  {getInitials(contact.first_name, contact.last_name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">
                      {contact.preferred_name || `${contact.first_name} ${contact.last_name}`}
                    </h4>
                    {contact.relationship_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRelationshipColor(contact.relationship_type)}`}>
                        {contact.relationship_type}
                      </span>
                    )}
                  </div>
                  
                  {contact.current_title && (
                    <p className="text-sm text-gray-600">{contact.current_title}</p>
                  )}
                  
                  {contact.current_company && (
                    <div className="flex items-center gap-1 mt-1">
                      <Building className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-600">{contact.current_company}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2">
                    {contact.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{contact.phone}</span>
                      </div>
                    )}
                    {contact.linkedin_url && (
                      <Linkedin className="w-3 h-3 text-gray-400" />
                    )}
                  </div>

                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <Tag className="w-3 h-3 text-gray-400" />
                      {contact.tags.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 3 && (
                        <span className="text-xs text-gray-500">+{contact.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  {contact.relationship_strength && (
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${
                            i < contact.relationship_strength!
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(showMenu === contact.contact_id ? null : contact.contact_id)
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
                
                {showMenu === contact.contact_id && (
                  <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectContact(contact)
                        setShowMenu(null)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteContact(contact.contact_id)
                        setShowMenu(null)
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Add New Contact</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newContact.first_name || ''}
                    onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newContact.last_name || ''}
                    onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newContact.email || ''}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newContact.phone || ''}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Title
                </label>
                <input
                  type="text"
                  value={newContact.current_title || ''}
                  onChange={(e) => setNewContact({ ...newContact, current_title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={newContact.current_company || ''}
                  onChange={(e) => setNewContact({ ...newContact, current_company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship Type
                </label>
                <select
                  value={newContact.relationship_type || ''}
                  onChange={(e) => setNewContact({ 
                    ...newContact, 
                    relationship_type: e.target.value as Contact['relationship_type']
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="mentor">Mentor</option>
                  <option value="peer">Peer</option>
                  <option value="report">Report</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="friend">Friend</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  value={newContact.linkedin_url || ''}
                  onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  onCloseAddModal()
                  setNewContact({})
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newContact.first_name && newContact.last_name) {
                    onSaveNewContact(newContact as any)
                    setNewContact({})
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!newContact.first_name || !newContact.last_name}
              >
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}