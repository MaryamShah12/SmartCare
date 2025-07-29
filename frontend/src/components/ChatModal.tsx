import React, { useState, useEffect, useRef } from 'react';
import socketService from '../services/socketService';

interface ChatMessage {
  id: number;
  sender_type: 'doctor' | 'patient';
  message: string;
  sent_at: string;
}

interface ChatModalProps {
  appointmentId: number;
  userType: 'doctor' | 'patient';
  userId: number;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ appointmentId, userType, userId, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatEnded, setChatEnded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    
    socketService.joinChat(appointmentId);

    
    if (socketService.socket) {
        socketService.socket.off('previous_messages');
        socketService.socket.off('new_message');
        socketService.socket.off('chat_ended');
    }

    
    socketService.onPreviousMessages((data: { messages: ChatMessage[] }) => {
        setMessages(data.messages);
    });

    
    socketService.onNewMessage((message: ChatMessage) => {
        setMessages(prev => [...prev, message]);
    });

    
    socketService.onChatEnded((data: { appointmentId: number }) => {
        setChatEnded(true);
    });

    return () => {
        
        if (socketService.socket) {
            socketService.socket.off('previous_messages');
            socketService.socket.off('new_message');
            socketService.socket.off('chat_ended');
        }
    };
}, [appointmentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    if (newMessage.trim() && !chatEnded) {
      socketService.sendMessage(appointmentId, newMessage, userType, userId);
      setNewMessage('');
    }
  };

  const endChat = () => {
    socketService.endChat(appointmentId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass max-w-2xl w-full h-[80vh] flex flex-col rounded-xl">
        {/* Chat Header */}
        <div className="p-4 border-b border-sky-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-sky-800">
            {userType === 'doctor' ? 'Patient Consultation' : 'Doctor Consultation'}
          </h3>
          <div className="flex gap-2">
            {!chatEnded && userType === 'doctor' && (
              <button
                onClick={endChat}
                className="px-3 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition text-sm"
              >
                End Chat
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-gray-500 text-white font-semibold hover:bg-gray-600 transition text-sm"
            >
              Close
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === userType ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.sender_type === userType
                    ? 'bg-sky-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="text-sm">{msg.message}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.sent_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        {!chatEnded && (
          <div className="p-4 border-t border-sky-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sky-500"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 rounded-lg bg-sky-500 text-white font-semibold hover:bg-sky-600 transition"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {chatEnded && (
          <div className="p-4 border-t border-sky-200 bg-gray-50 text-center">
            <p className="text-gray-600">This chat session has ended.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatModal;