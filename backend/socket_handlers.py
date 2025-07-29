# socket_handlers.py – Simplified connection handling
from flask import request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_jwt_extended import decode_token
from models import db, User, Doctor, Patient, Appointment, ChatMessage
from datetime import datetime
import time
import threading

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
                        doctor_room = f'doctor_{doctor.id}'
                        join_room(doctor_room)
                        print(f"✅ Doctor {doctor.name} joined room: {doctor_room}")

                elif user.role == 'patient':
                    patient = Patient.query.filter_by(user_id=user_id).first()
                    if patient:
                        patient_room = f'patient_{user_id}'  # Use user_id consistently
                        join_room(patient_room)
                        print(f"✅ Patient {patient.name} joined room: {patient_room}")
                        print(f"🔍 Socket {request.sid} is now in room {patient_room}")

            return True
        except Exception as e:
            print(f"❌ Connection error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    @socketio.on('join_room')
    def handle_join_room(data):
        room = data.get('room')
        if room:
           join_room(room)
           print(f"Client joined room: {room}")

    @socketio.on('verify_room_membership')
    def handle_verify_room_membership(data):
        room = data.get('room')
        print(f"🔍 Verifying room membership for {request.sid} in room {room}")
        
        
        room_clients = socketio.server.manager.get_participants(socketio.server.eio.namespace, room)
        print(f"📋 Clients in room {room}: {room_clients}")
        
        is_in_room = request.sid in room_clients
        print(f"✅ Socket {request.sid} in room {room}: {is_in_room}")
        
        emit('room_membership_verified', {
            'room': room,
            'is_member': is_in_room,
            'socket_id': request.sid
        })
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print(f"🔴 Client disconnected: {request.sid}")

    @socketio.on('verify_room')
    def handle_verify_room(data):
        room = data.get('room')
        print(f"🔍 Client {request.sid} requesting verification for room: {room}")
        emit('room_verified', {'room': room, 'status': 'connected'})    

    @socketio.on('instant_appointment_request')
    def handle_instant_appointment(data):
        try:
            with app.app_context():
                appointment_id = data.get('appointment_id')
                doctor_id = data.get('doctor_id')

                appointment = Appointment.query.get(appointment_id)
                if appointment:
                    socketio.emit(
                        'new_appointment_request',
                        {
                            'appointment': {
                                'id': appointment.id,
                                'patient_name': appointment.patient.name,
                                'symptoms': appointment.symptoms,
                                'appointment_type': appointment.appointment_type,
                                'start_time': appointment.start_time.isoformat(),
                                'patient': {
                                    'id': appointment.patient.id,
                                    'name': appointment.patient.name,
                                    'age': appointment.patient.age,
                                    'gender': appointment.patient.gender,
                                    'medical_history': appointment.patient.medical_history
                                }
                            }
                        },
                        room=f'doctor_{doctor_id}'
                    )
        except Exception as e:
            print(f"Error handling instant appointment: {e}")

    @socketio.on('appointment_response')
    def handle_appointment_response(data):
        try:
            with app.app_context():
                appointment_id = data.get('appointment_id')
                action = data.get('action')  

                appointment = Appointment.query.get(appointment_id)
                if appointment:
                    appointment.status = 'accepted' if action == 'accept' else 'rejected'
                    if action == 'accept' and appointment.appointment_type == 'instant':
                        appointment.chat_active = True

                    db.session.commit()

                    socketio.emit(
                        'appointment_updated',
                        {
                            'appointment_id': appointment_id,
                            'status': appointment.status,
                            'chat_active': appointment.chat_active
                        },
                        room=f'patient_{appointment.patient_id}'
                    )
        except Exception as e:
            print(f"Error handling appointment response: {e}")

    @socketio.on('join_chat')
    def handle_join_chat(data):
        appointment_id = data.get('appointment_id')
        join_room(f'chat_{appointment_id}')

        with app.app_context():
            messages = ChatMessage.query.filter_by(appointment_id=appointment_id).order_by(ChatMessage.sent_at).all()
            emit(
                'previous_messages',
                {
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
                }
            )

    @socketio.on('send_message')
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

                socketio.emit(
                    'new_message',
                    {
                        'id': chat_message.id,
                        'sender_type': sender_type,
                        'message': message_text,
                        'sent_at': chat_message.sent_at.isoformat()
                    },
                    room=f'chat_{appointment_id}'
                )
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

                    socketio.emit(
                        'chat_ended',
                        {
                            'appointment_id': appointment_id,
                            'ended_at': appointment.chat_ended_at.isoformat()
                        },
                        room=f'chat_{appointment_id}'
                    )
        except Exception as e:
            print(f"Error ending chat: {e}")