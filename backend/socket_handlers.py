from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import decode_token
from models import db, User, Doctor, Patient, Appointment, ChatMessage
from datetime import datetime


patient_socket_map = {}

def get_patient_socket_id(user_id):
    """Get socket ID for a patient user_id"""
    return patient_socket_map.get(str(user_id))

def get_session_id(patient_id, doctor_id):
    """Generate consistent session ID for patient-doctor pair"""
    return f"session_{min(patient_id, doctor_id)}_{max(patient_id, doctor_id)}"

def init_socket_handlers(socketio, app, online_doctors, online_patients):

    @socketio.on('connect')
    def handle_connect(auth):
        try:
            print(f"🔌 New connection attempt from {request.sid}")
            token = auth.get('token') if auth else None
            if not token:
                print("❌ No token provided")
                return False

            with app.app_context():
                decoded = decode_token(token, allow_expired=False)
                user_id = int(decoded['sub'])
                user = User.query.get(user_id)
                if not user:
                    print(f"❌ No user found for ID: {user_id}")
                    return False

                print(f"✅ User authenticated: {user.email} (Role: {user.role})")
                
                
                if user.role == 'doctor':
                    doctor = Doctor.query.filter_by(user_id=user_id).first()
                    if doctor:
                        room_name = f'doctor_{doctor.id}'
                        join_room(room_name)
                        print(f"✅ Doctor joined room: {room_name}")
                elif user.role == 'patient':
                    
                    patient = Patient.query.filter_by(user_id=user_id).first()
                    if patient:
                        
                        room_name = f'patient_{user_id}'
                        join_room(room_name)
                        
                        
                        patient_socket_map[str(user_id)] = request.sid
                        print(f"✅ Patient joined room: {room_name} (user_id: {user_id}, patient_id: {patient.id}, socket_id: {request.sid})")
                        print(f"📝 Updated patient_socket_map: {patient_socket_map}")
                        
                        
                        emit('room_join_confirmation', {
                            'room': room_name,
                            'user_id': user_id,
                            'patient_id': patient.id,
                            'socket_id': request.sid
                        })

            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False

    @socketio.on('join-session')
    def handle_join_session(data):
        try:
            with app.app_context():
                appointment_id = data.get('appointment_id')
                
                appointment = Appointment.query.get(appointment_id)
                if not appointment:
                    emit('error', {'message': 'Appointment not found'})
                    return

                
                patient = Patient.query.get(appointment.patient_id)
                doctor = Doctor.query.get(appointment.doctor_id)
                
                if not patient or not doctor:
                    emit('error', {'message': 'Patient or doctor not found'})
                    return

                session_id = get_session_id(patient.id, doctor.id)
                join_room(session_id)
                
                print(f"✅ User joined session: {session_id} for appointment: {appointment_id}")
                emit('joined-session', {'session_id': session_id})

                
                messages = ChatMessage.query.filter_by(appointment_id=appointment_id).order_by(ChatMessage.sent_at).all()
                emit('previous_messages', {
                    'messages': [
                        {
                            'id': msg.id,
                            'sender_type': msg.sender_type,
                            'message': msg.message,
                            'sent_at': msg.sent_at.isoformat(),
                            'is_read': msg.is_read
                        }
                        for msg in messages
                    ]
                })

        except Exception as e:
            print(f"Error joining session: {e}")
            emit('error', {'message': 'Failed to join session'})

    @socketio.on('send-message')
    def handle_send_message(data):
        try:
            with app.app_context():
                appointment_id = data.get('appointment_id')
                message_text = data.get('message')
                sender_type = data.get('sender_type')
                sender_id = data.get('sender_id')

                appointment = Appointment.query.get(appointment_id)
                if not appointment or not appointment.chat_active:
                    emit('error', {'message': 'Chat not active'})
                    return

                
                chat_message = ChatMessage(
                    appointment_id=appointment_id,
                    sender_type=sender_type,
                    sender_id=sender_id,
                    message=message_text
                )
                db.session.add(chat_message)
                db.session.commit()

                
                patient = Patient.query.get(appointment.patient_id)
                doctor = Doctor.query.get(appointment.doctor_id)
                session_id = get_session_id(patient.id, doctor.id)

                
                socketio.emit('receive-message', {
                    'id': chat_message.id,
                    'sender_type': sender_type,
                    'sender_id': sender_id,
                    'message': message_text,
                    'sent_at': chat_message.sent_at.isoformat(),
                    'timestamp': chat_message.sent_at.isoformat()
                }, room=session_id)

                print(f"💬 Message sent to session {session_id}: {message_text[:50]}...")

        except Exception as e:
            print(f"Error sending message: {e}")
            emit('error', {'message': 'Failed to send message'})

    @socketio.on('end_chat')
    def handle_end_chat(data):
        try:
            with app.app_context():
                appointment_id = data.get('appointment_id')
                appointment = Appointment.query.get(appointment_id)
                
                if appointment:
                    appointment.chat_active = False
                    appointment.chat_ended_at = datetime.utcnow()
                    db.session.commit()

                    
                    patient = Patient.query.get(appointment.patient_id)
                    doctor = Doctor.query.get(appointment.doctor_id)
                    session_id = get_session_id(patient.id, doctor.id)

                    socketio.emit('chat_ended', {
                        'appointment_id': appointment_id,
                        'ended_at': appointment.chat_ended_at.isoformat()
                    }, room=session_id)

        except Exception as e:
            print(f"Error ending chat: {e}")
    
    @socketio.on('test_connection')
    def handle_test_connection(data):
        user_id = data.get('user_id')
        role = data.get('role')
    
        if role == 'patient':
            room_name = f'patient_{user_id}'
            join_room(room_name)  
            
            with app.app_context():
                patient = Patient.query.filter_by(user_id=user_id).first()
                patient_info = {
                    'patient_id': patient.id if patient else None,
                    'user_id': user_id
                }
                print(f"🧪 Test connection patient info: {patient_info}")
            
            emit('connection_test_result', [
                {
                    'joined_room': room_name,
                    'message': f'Successfully joined {room_name}',
                    'patient_info': patient_info if 'patient_info' in locals() else None
                }
            ])
            print(f"🧪 Test: Patient {user_id} joined room {room_name}")

    @socketio.on('disconnect')
    def handle_disconnect():
        print(f"🔴 Client disconnected: {request.sid}")
        
        
        for user_id, socket_id in list(patient_socket_map.items()):
            if socket_id == request.sid:
                del patient_socket_map[user_id]
                print(f"🗑️ Removed patient socket mapping for user_id: {user_id}")
                print(f"📝 Updated patient_socket_map: {patient_socket_map}")
                break