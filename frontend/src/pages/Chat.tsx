import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Send, Loader2, StopCircle, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStream } from '@/hooks/useChatStream'
import { ErrorMessage } from '@/components/common/ErrorMessage'
import { ConversationSidebar } from '@/components/chat/ConversationSidebar'

export default function Chat() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>()
  const [showSidebar, setShowSidebar] = useState(true)
  
  const { 
    messages, 
    conversationId,
    loading,
    streaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadHistory,
    messagesEndRef 
  } = useChatStream(selectedConversationId)
  
  const [input, setInput] = useState('')
  const [useStreaming, setUseStreaming] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    
    const message = input
    setInput('')
    setError(null)
    
    try {
      await sendMessage(message, useStreaming)
    } catch (err: any) {
      setError(err.message || 'Failed to send message')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectConversation = (convId?: string) => {
    setSelectedConversationId(convId)
    if (convId) {
      loadHistory()
    } else {
      clearMessages()
    }
  }

  const handleNewConversation = () => {
    setSelectedConversationId(undefined)
    clearMessages()
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Conversation Sidebar */}
      <div className={cn(
        "transition-all duration-300",
        showSidebar ? "w-80" : "w-0 overflow-hidden"
      )}>
        {showSidebar && (
          <ConversationSidebar
            currentConversationId={conversationId || selectedConversationId}
            onSelectConversation={handleSelectConversation}
            onNewConversation={handleNewConversation}
          />
        )}
      </div>

      {/* Chat Main Area */}
      <Card className="flex-1 flex flex-col">
        {/* Header with streaming toggle */}
        <div className="border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowSidebar(!showSidebar)}
              size="icon"
              variant="ghost"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">Career Chat</h2>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="streaming-mode" className="text-sm">
              Streaming Mode
            </Label>
            <Switch
              id="streaming-mode"
              checked={useStreaming}
              onCheckedChange={setUseStreaming}
              disabled={streaming}
            />
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-lg mb-2">Welcome to Pathfinder Chat!</p>
              <p className="text-sm">Ask me anything about your career journey.</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p className="text-sm whitespace-pre-wrap">
                  {message.content || (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </span>
                  )}
                </p>
                {message.content && (
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))}
          
          {loading && !streaming && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="border-t p-4">
            <ErrorMessage message={error} />
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={streaming ? "Receiving response..." : "Type your message..."}
              disabled={streaming}
              className="flex-1"
            />
            {streaming ? (
              <Button
                onClick={stopStreaming}
                variant="destructive"
                size="icon"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSend}
                disabled={!input.trim()}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          {useStreaming && (
            <p className="text-xs text-muted-foreground mt-2">
              Streaming mode enabled - responses will appear word by word
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}