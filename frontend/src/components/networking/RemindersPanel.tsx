import { useState } from 'react'
import { Bell, Calendar, Clock, CheckCircle, Plus } from 'lucide-react'
import type { Reminder } from '@/services/networkingService'

interface Props {
  reminders: Reminder[]
  onCompleteReminder: (id: string) => void
  onUpdateReminder: (id: string, updates: Partial<Reminder>) => void
  onCreateReminder: (reminder: Omit<Reminder, 'reminder_id' | 'user_id' | 'created_at'>) => void
}

export default function RemindersPanel({ 
  reminders, 
  onCompleteReminder, 
  onUpdateReminder, 
  onCreateReminder 
}: Props) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newReminder, setNewReminder] = useState<Partial<Reminder>>({
    reminder_type: 'follow_up',
    reminder_date: new Date().toISOString().split('T')[0],
    status: 'pending'
  })

  const pendingReminders = reminders.filter(r => r.status === 'pending')
  const completedReminders = reminders.filter(r => r.status === 'completed')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upcoming Reminders</h3>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Reminder
          </button>
        </div>

        {showCreateForm && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact ID *
                </label>
                <input
                  type="text"
                  value={newReminder.contact_id || ''}
                  onChange={(e) => setNewReminder({ ...newReminder, contact_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter contact ID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={newReminder.reminder_type}
                  onChange={(e) => setNewReminder({ 
                    ...newReminder, 
                    reminder_type: e.target.value as Reminder['reminder_type']
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="follow_up">Follow Up</option>
                  <option value="birthday">Birthday</option>
                  <option value="milestone">Milestone</option>
                  <option value="check_in">Check In</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={newReminder.reminder_date}
                  onChange={(e) => setNewReminder({ ...newReminder, reminder_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  value={newReminder.subject || ''}
                  onChange={(e) => setNewReminder({ ...newReminder, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="What to remember?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newReminder.notes || ''}
                  onChange={(e) => setNewReminder({ ...newReminder, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (newReminder.contact_id && newReminder.subject && newReminder.reminder_date) {
                      onCreateReminder(newReminder as any)
                      setNewReminder({
                        reminder_type: 'follow_up',
                        reminder_date: new Date().toISOString().split('T')[0],
                        status: 'pending'
                      })
                      setShowCreateForm(false)
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Reminder
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {pendingReminders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No pending reminders</p>
            </div>
          ) : (
            pendingReminders.map((reminder) => (
              <div
                key={reminder.reminder_id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        reminder.reminder_type === 'follow_up' ? 'bg-blue-100 text-blue-700' :
                        reminder.reminder_type === 'birthday' ? 'bg-pink-100 text-pink-700' :
                        reminder.reminder_type === 'milestone' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {reminder.reminder_type.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(reminder.reminder_date).toLocaleDateString()}
                      </div>
                      {reminder.reminder_time && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          {reminder.reminder_time}
                        </div>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900">{reminder.subject}</h4>
                    {reminder.notes && (
                      <p className="text-sm text-gray-600 mt-1">{reminder.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onCompleteReminder(reminder.reminder_id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {completedReminders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Completed Reminders</h3>
          <div className="space-y-2">
            {completedReminders.slice(0, 5).map((reminder) => (
              <div key={reminder.reminder_id} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600 line-through">{reminder.subject}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(reminder.reminder_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}