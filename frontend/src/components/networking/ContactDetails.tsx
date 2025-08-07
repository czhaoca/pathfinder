import { useState } from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  Linkedin, 
  MapPin,
  Building,
  Calendar,
  MessageSquare,
  Edit2,
  Save,
  X,
  Plus,
  Clock,
  Tag
} from 'lucide-react'
import type { Contact, Interaction } from '@/services/networkingService'

interface Props {
  contact: Contact
  onUpdate: (updates: Partial<Contact>) => void
  onLogInteraction: (interaction: Omit<Interaction, 'interaction_id' | 'user_id' | 'created_at'>) => void
}

export default function ContactDetails({ contact, onUpdate, onLogInteraction }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContact, setEditedContact] = useState(contact)
  const [showInteractionForm, setShowInteractionForm] = useState(false)
  const [newInteraction, setNewInteraction] = useState<Partial<Interaction>>({
    interaction_type: 'meeting',
    interaction_date: new Date().toISOString().split('T')[0]
  })

  const handleSave = () => {
    onUpdate(editedContact)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedContact(contact)
    setIsEditing(false)
  }

  const handleLogInteraction = () => {
    if (newInteraction.subject) {
      onLogInteraction({
        contact_id: contact.contact_id,
        interaction_type: newInteraction.interaction_type || 'meeting',
        interaction_date: newInteraction.interaction_date || new Date().toISOString(),
        subject: newInteraction.subject,
        notes: newInteraction.notes,
        location: newInteraction.location,
        duration_minutes: newInteraction.duration_minutes,
        sentiment: newInteraction.sentiment,
        follow_up_required: newInteraction.follow_up_required,
        follow_up_date: newInteraction.follow_up_date,
        follow_up_notes: newInteraction.follow_up_notes
      })
      setNewInteraction({
        interaction_type: 'meeting',
        interaction_date: new Date().toISOString().split('T')[0]
      })
      setShowInteractionForm(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
              {contact.first_name[0]}{contact.last_name[0]}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {isEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editedContact.first_name}
                      onChange={(e) => setEditedContact({ ...editedContact, first_name: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={editedContact.last_name}
                      onChange={(e) => setEditedContact({ ...editedContact, last_name: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded"
                    />
                  </div>
                ) : (
                  `${contact.first_name} ${contact.last_name}`
                )}
              </h3>
              {contact.current_title && (
                <p className="text-gray-600">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedContact.current_title || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, current_title: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded w-full"
                    />
                  ) : (
                    contact.current_title
                  )}
                </p>
              )}
              {contact.current_company && (
                <div className="flex items-center gap-1 mt-1">
                  <Building className="w-4 h-4 text-gray-400" />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedContact.current_company || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, current_company: e.target.value })}
                      className="px-2 py-1 border border-gray-300 rounded"
                    />
                  ) : (
                    <span className="text-sm text-gray-600">{contact.current_company}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="p-2 text-green-600 hover:bg-green-50 rounded"
                >
                  <Save className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Contact Information */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Contact Information</h4>
          <div className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {isEditing ? (
                  <input
                    type="email"
                    value={editedContact.email || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, email: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded flex-1"
                  />
                ) : (
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                )}
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedContact.phone || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded flex-1"
                  />
                ) : (
                  <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                    {contact.phone}
                  </a>
                )}
              </div>
            )}
            {contact.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 text-gray-400" />
                {isEditing ? (
                  <input
                    type="url"
                    value={editedContact.linkedin_url || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, linkedin_url: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded flex-1"
                  />
                ) : (
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    LinkedIn Profile
                  </a>
                )}
              </div>
            )}
            {contact.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.location || ''}
                    onChange={(e) => setEditedContact({ ...editedContact, location: e.target.value })}
                    className="px-2 py-1 border border-gray-300 rounded flex-1"
                  />
                ) : (
                  <span className="text-gray-700">{contact.location}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Relationship Details */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Relationship</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Type</span>
              {isEditing ? (
                <select
                  value={editedContact.relationship_type || ''}
                  onChange={(e) => setEditedContact({ 
                    ...editedContact, 
                    relationship_type: e.target.value as Contact['relationship_type']
                  })}
                  className="px-2 py-1 border border-gray-300 rounded"
                >
                  <option value="">None</option>
                  <option value="mentor">Mentor</option>
                  <option value="peer">Peer</option>
                  <option value="report">Report</option>
                  <option value="recruiter">Recruiter</option>
                  <option value="friend">Friend</option>
                </select>
              ) : (
                <span className="font-medium capitalize">
                  {contact.relationship_type || 'Not specified'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Strength</span>
              {isEditing ? (
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={editedContact.relationship_strength || 3}
                  onChange={(e) => setEditedContact({ 
                    ...editedContact, 
                    relationship_strength: parseInt(e.target.value)
                  })}
                  className="w-24"
                />
              ) : (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i < (contact.relationship_strength || 0)
                          ? 'bg-blue-500'
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
            {contact.last_interaction && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Interaction</span>
                <span className="font-medium">
                  {new Date(contact.last_interaction).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {(contact.bio || isEditing) && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Bio</h4>
            {isEditing ? (
              <textarea
                value={editedContact.bio || ''}
                onChange={(e) => setEditedContact({ ...editedContact, bio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Add notes about this contact..."
              />
            ) : (
              <p className="text-gray-700 text-sm">{contact.bio}</p>
            )}
          </div>
        )}

        {/* Tags */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {contact.tags?.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                {tag}
                {isEditing && (
                  <button
                    onClick={() => {
                      const newTags = editedContact.tags?.filter((_, i) => i !== idx)
                      setEditedContact({ ...editedContact, tags: newTags })
                    }}
                    className="ml-1 text-gray-500 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {isEditing && (
              <button
                onClick={() => {
                  const newTag = prompt('Enter new tag:')
                  if (newTag) {
                    setEditedContact({ 
                      ...editedContact, 
                      tags: [...(editedContact.tags || []), newTag]
                    })
                  }
                }}
                className="px-2 py-1 border border-dashed border-gray-300 rounded-full text-sm text-gray-500 hover:border-gray-400"
              >
                <Plus className="w-3 h-3 inline mr-1" />
                Add tag
              </button>
            )}
          </div>
        </div>

        {/* Log Interaction Button */}
        <div>
          <button
            onClick={() => setShowInteractionForm(!showInteractionForm)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Log Interaction
          </button>
        </div>

        {/* Interaction Form */}
        {showInteractionForm && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={newInteraction.interaction_type}
                onChange={(e) => setNewInteraction({ 
                  ...newInteraction, 
                  interaction_type: e.target.value as Interaction['interaction_type']
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="meeting">Meeting</option>
                <option value="email">Email</option>
                <option value="call">Call</option>
                <option value="message">Message</option>
                <option value="event">Event</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={newInteraction.interaction_date?.split('T')[0] || ''}
                onChange={(e) => setNewInteraction({ 
                  ...newInteraction, 
                  interaction_date: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={newInteraction.subject || ''}
                onChange={(e) => setNewInteraction({ ...newInteraction, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="What did you discuss?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={newInteraction.notes || ''}
                onChange={(e) => setNewInteraction({ ...newInteraction, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sentiment
              </label>
              <select
                value={newInteraction.sentiment || ''}
                onChange={(e) => setNewInteraction({ 
                  ...newInteraction, 
                  sentiment: e.target.value as Interaction['sentiment']
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">None</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="followup"
                checked={newInteraction.follow_up_required || false}
                onChange={(e) => setNewInteraction({ 
                  ...newInteraction, 
                  follow_up_required: e.target.checked
                })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
              />
              <label htmlFor="followup" className="text-sm text-gray-700">
                Follow-up required
              </label>
            </div>

            {newInteraction.follow_up_required && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={newInteraction.follow_up_date?.split('T')[0] || ''}
                  onChange={(e) => setNewInteraction({ 
                    ...newInteraction, 
                    follow_up_date: e.target.value
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleLogInteraction}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Interaction
              </button>
              <button
                onClick={() => {
                  setShowInteractionForm(false)
                  setNewInteraction({
                    interaction_type: 'meeting',
                    interaction_date: new Date().toISOString().split('T')[0]
                  })
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}