import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, 
  MessageSquare, 
  Plus, 
  Trash2, 
  Calendar,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { chatService } from '@/services/chatService'
import { ConversationSummary } from '@/types/chat'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ConversationSidebarProps {
  currentConversationId?: string
  onSelectConversation: (conversationId?: string) => void
  onNewConversation: () => void
}

export function ConversationSidebar({
  currentConversationId,
  onSelectConversation,
  onNewConversation
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      setLoading(true)
      const response = await chatService.getChatHistory()
      if (response.conversations) {
        setConversations(response.conversations)
      }
    } catch (error: any) {
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadConversations()
      return
    }

    try {
      const response = await chatService.searchConversations(searchQuery)
      setConversations(response.results)
    } catch (error: any) {
      toast.error('Search failed')
    }
  }

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this conversation?')) {
      return
    }

    try {
      await chatService.deleteConversation(conversationId)
      toast.success('Conversation deleted')
      
      // Update local state
      setConversations(prev => prev.filter(c => c.conversation_id !== conversationId))
      
      // If deleting current conversation, clear selection
      if (conversationId === currentConversationId) {
        onSelectConversation(undefined)
      }
    } catch (error: any) {
      toast.error('Failed to delete conversation')
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b">
        <Button 
          onClick={onNewConversation}
          className="w-full mb-3"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Conversation
        </Button>
        
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search conversations..."
            className="flex-1"
            size="sm"
          />
          <Button 
            onClick={handleSearch}
            size="icon"
            variant="outline"
            className="h-8 w-8"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new conversation to begin</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.conversation_id}
                  onClick={() => onSelectConversation(conv.conversation_id)}
                  className={cn(
                    "group p-3 rounded-lg cursor-pointer transition-colors",
                    "hover:bg-accent",
                    currentConversationId === conv.conversation_id && "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {conv.title || 'Untitled Conversation'}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conv.first_message}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(conv.last_message_at), 'MMM d, h:mm a')}
                        </span>
                        <span>•</span>
                        <span>{conv.message_count} messages</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={(e) => handleDelete(conv.conversation_id, e)}
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  )
}