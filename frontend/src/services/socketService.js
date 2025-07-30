import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect(token) {
    if (this.socket) {
      this.socket.removeAllListeners(); 
      this.socket.disconnect();
    }

    console.log('🔌 Establishing new WebSocket connection...');
    this.socket = io('http://127.0.0.1:8000', {
      auth: { token },
      transports: ['polling', 'websocket'],
    });

    this.socket.on('connect', () => console.log(' WebSocket Connected:', this.socket.id));
    this.socket.on('disconnect', (reason) => console.log(' WebSocket Disconnected:', reason));
    this.socket.on('connect_error', (err) => console.error('‼ WebSocket Connection Error:', err));
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket.');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  logout() {
    console.log(' Logging out');
    this.disconnect();
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }

  onNewAppointmentRequest(callback) {
    this.socket?.on('new_appointment_request', callback);
  }

  joinChat(appointmentId) {
    this.socket?.emit('join_chat', { appointment_id: appointmentId });
  }

  sendMessage(appointmentId, message, senderType, senderId) {
    this.socket?.emit('send_message', { appointment_id: appointmentId, message, sender_type: senderType, sender_id: senderId });
  }

  endChat(appointmentId) {
    this.socket?.emit('end_chat', { appointment_id: appointmentId });
  }

  onPreviousMessages(callback) {
    this.socket?.on('previous_messages', callback);
  }

  onNewMessage(callback) {
    this.socket?.on('new_message', callback);
  }

  onChatEnded(callback) {
    this.socket?.on('chat_ended', callback);
  }

  onAppointmentUpdated(callback) {
    this.socket?.on('appointment_updated', (data) => {
      console.log(' RECEIVED appointment_updated EVENT:', data);
      callback(data);
    });
  }

  off(eventName) {
    this.socket?.off(eventName);
  }

  onAnyEvent(callback) {
    if (this.socket) {
      this.socket.onAny((eventName, ...args) => {
        console.log('WebSocket event received:', eventName, args);
        if (callback) callback(eventName, args);
      });
    }
  }

  joinSession(appointmentId) {
    console.log('Joining session for appointment:', appointmentId);
    this.socket?.emit('join-session', { appointment_id: appointmentId });
  }

  onJoinedSession(callback) {
    this.socket?.on('joined-session', callback);
  }

  onReceiveMessage(callback) {
    this.socket?.on('receive-message', callback);
  }

  sendMessageToSession(appointmentId, message, senderType, senderId) {
    console.log('📤 Sending message to session:', { appointmentId, message, senderType, senderId });
    this.socket?.emit('send-message', { 
      appointment_id: appointmentId, 
      message, 
      sender_type: senderType, 
      sender_id: senderId 
    });
  }
}

export default new SocketService();