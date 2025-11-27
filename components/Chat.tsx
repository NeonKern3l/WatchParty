import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User as UserIcon, Bot } from 'lucide-react';
import { ChatMessage, User } from '../types';
import { generateAiChatResponse } from '../services/gemini';

interface ChatProps {
  messages: ChatMessage[];
  currentUser: User;
  onSendMessage: (text: string) => void;
  onSendAiMessage: (text: string) => void;
  mediaName: string;
}

export const Chat: React.FC<ChatProps> = ({ messages, currentUser, onSendMessage, onSendAiMessage, mediaName }) => {
  const [input, setInput] = useState('');
  const [isAiMode, setIsAiMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const text = input;
    setInput('');

    if (isAiMode) {
      // Send user message locally first
      onSendMessage(text);
      setIsTyping(true);
      
      // Construct basic history for the AI
      const history = messages
        .filter(m => m.isAi || m.sender === currentUser.name)
        .slice(-6) // Last 6 messages for context
        .map(m => ({ role: m.isAi ? 'model' : 'user', content: m.text }));

      const aiResponse = await generateAiChatResponse(history, mediaName);
      onSendAiMessage(aiResponse);
      setIsTyping(false);
    } else {
      onSendMessage(text);
    }
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 border-l border-dark-800">
      {/* Header */}
      <div className="p-4 border-b border-dark-800 flex justify-between items-center bg-dark-900 z-10">
        <h2 className="font-semibold text-gray-200">Party Chat</h2>
        <button
          onClick={() => setIsAiMode(!isAiMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            isAiMode 
              ? 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow-lg shadow-purple-900/50' 
              : 'bg-dark-800 text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles size={14} />
          {isAiMode ? 'AI Enabled' : 'Enable AI'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender === currentUser.name;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                  {msg.isAi && <Bot size={10} className="text-brand-400" />}
                  {msg.sender}
                </span>
                <div
                  className={`px-3 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-tr-sm'
                      : msg.isAi
                      ? 'bg-gradient-to-br from-brand-900 to-dark-800 border border-brand-500/30 text-gray-200 rounded-tl-sm'
                      : 'bg-dark-800 text-gray-200 rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-dark-800 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-75" />
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 bg-dark-900 border-t border-dark-800">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isAiMode ? "Ask Gemini about the movie..." : "Say something..."}
            className="w-full bg-dark-950 text-white rounded-full pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 border border-dark-800 placeholder-gray-600 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-600 rounded-full text-white disabled:opacity-50 hover:bg-brand-500 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};