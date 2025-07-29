from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User, Patient, Doctor, Appointment
import bcrypt
import os
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import json

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

print("Routes blueprint created")

@bp.route('/test', methods=['GET'])
def test():
    print("Test route called")
    return {"message": "Backend is running"}

@bp.route('/debug', methods=['GET', 'POST'])
def debug():
    print(f"Debug route called with method: {request.method}")
    return {"message": f"Debug route working - Method: {request.method}"}

@bp.route('/check-users', methods=['GET'])
def check_users():
    try:
        users = User.query.all()
        user_list = []
        for user in users:
            user_list.append({
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "has_password": len(user.password) > 0 if user.password else False
            })
        return jsonify({"users": user_list}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    print(f"=== LOGIN ROUTE CALLED ===")
    print(f"Method: {request.method}")
    print(f"Content-Type: {request.headers.get('Content-Type')}")
    print(f"Origin: {request.headers.get('Origin')}")
    
    if request.method == 'OPTIONS':
        print("Handling OPTIONS request")
        return jsonify({"message": "OPTIONS handled"}), 200
    
    try:
        print("Processing login request...")
        
        try:
            data = request.get_json()
            print(f"JSON data received: {data}")
        except Exception as json_error:
            print(f"JSON parsing error: {json_error}")
            return jsonify({"error": "Invalid JSON data"}), 400
        
        if not data:
            print("No data received")
            return jsonify({"error": "No data provided"}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        print(f"Email: '{email}', Password provided: {bool(password)}")

        if not email or not password:
            print("Missing email or password")
            return jsonify({"error": "Email and password required"}), 400

        user = User.query.filter_by(email=email).first()
        print(f"User query result: {user}")
        
        if not user:
            print(f"No user found with email: {email}")
            return jsonify({"error": "Invalid email or password"}), 401

        print(f"User found - ID: {user.id}, Role: {user.role}")

        try:
            print(f"Password check starting...")
            print(f"Stored password type: {type(user.password)}")
            
            if isinstance(user.password, str):
                try:
                    stored_hash = bytes.fromhex(user.password)
                except ValueError:
                    stored_hash = user.password.encode('utf-8')
            else:
                stored_hash = user.password
            
            print(f"Hash to check against (first 20 bytes): {stored_hash[:20]}")
            password_check = bcrypt.checkpw(password.encode('utf-8'), stored_hash)
            print(f"Password verification result: {password_check}")
            
        except Exception as pwd_error:
            print(f"Password check error: {pwd_error}")
            print(f"Trying alternative password check methods...")
            
            if user.password == password:
                print("WARNING: Password stored as plain text!")
                password_check = True
            else:
                print("All password check methods failed")
                return jsonify({"error": "Authentication error"}), 401
        
        if not password_check:
            print("Password verification failed")
            return jsonify({"error": "Invalid email or password"}), 401

        if user.role == 'doctor':
            doctor = Doctor.query.filter_by(user_id=user.id).first()
            if not doctor or not doctor.is_approved:
                print("Doctor not approved")
                return jsonify({"error": "Doctor account not approved by admin"}), 403

        if hasattr(user, 'is_active') and not user.is_active:
            print("User account inactive")
            return jsonify({"error": "Account is blocked"}), 403

        try:
            access_token = create_access_token(identity=str(user.id))
            print(f"Login successful for user: {email}")
            
            return jsonify({
                "access_token": access_token, 
                "role": user.role,
                "user_id": user.id,
                "message": "Login successful"
            }), 200
        except Exception as token_error:
            print(f"Token creation error: {token_error}")
            return jsonify({"error": "Token creation failed"}), 500
    
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Login failed"}), 500

@bp.route('/signup/patient', methods=['POST'])
def signup_patient():
    try:
        print("Patient signup called")
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        age = data.get('age')
        gender = data.get('gender')
        medical_history = data.get('medical_history')

        if not all([email, password, name, age]):
            return jsonify({"error": "Missing required fields"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user = User(email=email, password=hashed_password, role='patient')
        db.session.add(user)
        db.session.commit()

        patient = Patient(user_id=user.id, name=name, age=age, gender=gender, medical_history=medical_history)
        db.session.add(patient)
        db.session.commit()

        print(f"Patient registered successfully: {email}")
        return jsonify({"message": "Patient registered successfully"}), 201
    
    except Exception as e:
        print(f"Patient signup error: {e}")
        db.session.rollback()
        return jsonify({"error": "Registration failed"}), 500

@bp.route('/signup/doctor', methods=['POST'])
def signup_doctor():
    try:
        print("Doctor signup called")
        
        email = request.form.get('email')
        password = request.form.get('password')
        name = request.form.get('name')
        specialization = request.form.get('specialization')

        if not all([email, password, name, specialization]):
            return jsonify({"error": "Missing required fields"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        document_paths = []
        if 'documents' in request.files:
            files = request.files.getlist('documents')
            if len(files) > 2:
                return jsonify({"error": "Maximum two documents allowed"}), 400
            for file in files:
                if file and file.filename:
                    if not (file.filename.lower().endswith(('.pdf', '.doc', '.docx'))):
                        return jsonify({"error": "Documents must be PDF or Word files"}), 400
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    document_paths.append(filename)
        
        photo_path = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file and file.filename:
                if not (file.filename.lower().endswith(('.jpg', '.jpeg', '.png'))):
                    return jsonify({"error": "Photo must be JPG, JPEG, or PNG"}), 400
                filename = secure_filename(file.filename)
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)
                photo_path = filename

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user = User(email=email, password=hashed_password, role='doctor')
        db.session.add(user)
        db.session.commit()

        doctor = Doctor(
            user_id=user.id,
            name=name,
            specialization=specialization,
            documents=','.join(document_paths) if document_paths else None,
            photo=photo_path,
            is_approved=False
        )
        db.session.add(doctor)
        db.session.commit()

        return jsonify({"message": "Doctor registration pending admin approval"}), 201
    
    except Exception as e:
        print(f"Doctor signup error: {e}")
        db.session.rollback()
        return jsonify({"error": "Registration failed"}), 500

@bp.route('/admin/pending-doctors', methods=['GET'])
@jwt_required()
def get_pending_doctors():
    try:
        print("=== PENDING DOCTORS ROUTE CALLED ===")
        print(f"Authorization header: {request.headers.get('Authorization')}")
        
        user_id_str = get_jwt_identity()
        print(f"JWT Identity (raw): {user_id_str}")
        
        try:
            user_id = int(user_id_str)
            print(f"Converted user_id: {user_id}")
        except (ValueError, TypeError) as e:
            print(f"Error converting user_id: {e}")
            return jsonify({"error": "Invalid token"}), 401
        
        user = User.query.get(user_id)
        if not user:
            print(f"No user found with ID: {user_id}")
            return jsonify({"error": "User not found"}), 404
            
        print(f"User role: {user.role}")
        if user.role != 'admin':
            print("Unauthorized access to pending doctors")
            return jsonify({"error": "Admin access required"}), 403

        pending_doctors = Doctor.query.filter_by(is_approved=False).all()
        doctors_list = [
            {
                "id": doctor.id,
                "user_id": doctor.user_id,
                "name": doctor.name,
                "email": doctor.user.email,
                "specialization": doctor.specialization,
                "documents": doctor.documents.split(',') if doctor.documents else [],
                "photo": doctor.photo
            }
            for doctor in pending_doctors
        ]
        print(f"Returning {len(doctors_list)} pending doctors")
        return jsonify({"doctors": doctors_list}), 200
    
    except Exception as e:
        print(f"Error fetching pending doctors: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch pending doctors"}), 500

@bp.route('/admin/approve-doctor/<int:doctor_id>', methods=['POST'])
@jwt_required()
def approve_doctor(doctor_id):
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        user = User.query.get(user_id)
        
        if not user or user.role != 'admin':
            print("Unauthorized access to approve doctor")
            return jsonify({"error": "Admin access required"}), 403

        doctor = Doctor.query.get_or_404(doctor_id)
        doctor.is_approved = True
        db.session.commit()
        print(f"Doctor {doctor.name} approved")
        return jsonify({"message": f"Doctor {doctor.name} approved successfully"}), 200
    
    except Exception as e:
        print(f"Error approving doctor: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to approve doctor"}), 500

@bp.route('/admin/decline-doctor/<int:doctor_id>', methods=['POST'])
@jwt_required()
def decline_doctor(doctor_id):
    try:
        user_id_str = get_jwt_identity()
        user_id = int(user_id_str)
        user = User.query.get(user_id)
        
        if not user or user.role != 'admin':
            print("Unauthorized access to decline doctor")
            return jsonify({"error": "Admin access required"}), 403

        doctor = Doctor.query.get_or_404(doctor_id)
        user = User.query.get_or_404(doctor.user_id)
        user.is_active = False
        db.session.commit()
        print(f"Doctor {doctor.name} declined")
        return jsonify({"message": f"Doctor {doctor.name} declined successfully"}), 200
    
    except Exception as e:
        print(f"Error declining doctor: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to decline doctor"}), 500

@bp.route('/uploads/<filename>', methods=['GET'])
def serve_uploaded_file(filename):
    try:
        print(f"Serving file: {filename}")
        return send_from_directory(current_app.config['UPLOAD_FOLDER'], filename)
    except Exception as e:
        print(f"Error serving file {filename}: {e}")
        return jsonify({"error": "File not found"}), 404

@bp.route('/doctor/appointments', methods=['GET'])
@jwt_required()
def get_doctor_appointments():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'doctor':
            return jsonify({"error": "Doctor access required"}), 403

        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404

        # JOIN appointment → patient → user
        rows = (
            db.session.query(Appointment, Patient, User)
            .join(Patient, Appointment.patient_id == Patient.id)
            .join(User, Patient.user_id == User.id)
            .filter(Appointment.doctor_id == doctor.id)
            .all()
        )

        scheduled = []
        pending = []

        for appt, patient, _ in rows:
            scheduled.append({
                "id": appt.id,
                "patient": {
                    "id": patient.id,
                    "name": patient.name,
                    "age": patient.age,
                    "gender": patient.gender,
                    "medical_history": patient.medical_history
                },
                "appointment_type": appt.appointment_type,
                "start_time": appt.start_time.isoformat(),
                "end_time": appt.end_time.isoformat(),
                "status": appt.status,
                "symptoms": appt.symptoms,
                "report_file": appt.report_file
            }) if appt.status == 'accepted' else None

            pending.append({
                "id": appt.id,
                "patient": {
                    "id": patient.id,
                    "name": patient.name,
                    "age": patient.age,
                    "gender": patient.gender,
                    "medical_history": patient.medical_history
                },
                "appointment_type": appt.appointment_type,
                "start_time": appt.start_time.isoformat(),
                "end_time": appt.end_time.isoformat(),
                "status": appt.status,
                "symptoms": appt.symptoms,
                "report_file": appt.report_file
            }) if appt.status == 'pending' else None

        
        scheduled = [s for s in scheduled if s]
        pending   = [p for p in pending if p]

        return jsonify({"scheduled": scheduled, "pending": pending}), 200
    except Exception as e:
        print("Doctor appointments error:", e)
        return jsonify({"error": "Failed to fetch appointments"}), 500
    
def _handle_appointment(appointment_id, new_status):
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'doctor':
            return jsonify({"error": "Doctor access required"}), 403

        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404

        appointment = Appointment.query.filter_by(
            id=appointment_id, 
            doctor_id=doctor.id
        ).first()
        
        if not appointment:
            return jsonify({"error": "Appointment not found or not yours"}), 404

        print(f"Updating appointment {appointment_id} to {new_status}")
        appointment.status = new_status
        
        
        if new_status == 'accepted' and appointment.appointment_type == 'instant':
            appointment.chat_active = True
            
        db.session.commit()
        print(f"Appointment {appointment_id} updated successfully to {new_status}")
        
        
        try:
            from app import socketio
            
            # Get patient info with detailed logging
            patient = Patient.query.get(appointment.patient_id)
            if patient:
                room_name = f"patient_{patient.user_id}"
                print(f"=== WEBSOCKET EMISSION DEBUG ===")
                print(f"Appointment ID: {appointment_id}")
                print(f"Patient ID: {appointment.patient_id}")
                print(f"Patient User ID: {patient.user_id}")
                print(f"Patient Name: {patient.name}")
                print(f"Emitting to room: {room_name}")
                print(f"Status: {new_status}")
                print(f"Chat Active: {appointment.chat_active if new_status == 'accepted' else False}")
                print("================================")
                
                socketio.emit('appointment_updated', {
                    'appointment_id': appointment_id,
                    'status': new_status,
                    'chat_active': appointment.chat_active if new_status == 'accepted' else False
                }, room=room_name)
                
                print(f"✅ WebSocket notification sent to {room_name}")
            else:
                print("❌ Patient not found for WebSocket emission")
        except Exception as ws_error:
            print(f"❌ WebSocket error: {ws_error}")
            import traceback
            traceback.print_exc()
        
        return jsonify({"message": f"Appointment {new_status} successfully"}), 200
        
    except Exception as e:
        print(f"Handle appointment error: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({"error": "Failed to update appointment"}), 500

@bp.route('/doctor/appointment/<int:appointment_id>/accept', methods=['POST'])
@jwt_required()
def accept_appointment(appointment_id):
    return _handle_appointment(appointment_id, 'accepted')

@bp.route('/doctor/appointment/<int:appointment_id>/reject', methods=['POST'])
@jwt_required()
def reject_appointment(appointment_id):
    return _handle_appointment(appointment_id, 'rejected')

@bp.route('/doctor/profile', methods=['GET', 'POST'])
@jwt_required()
def manage_doctor_profile():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'doctor':
            return jsonify({"error": "Doctor access required"}), 403

        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404

        if request.method == 'GET':
            return jsonify({
                "user_id": user_id,
                "name": doctor.name,
                "email": user.email,
                "specialization": doctor.specialization,
                "availability": json.loads(doctor.availability) if doctor.availability else {},
                "instant_available": doctor.instant_available,
                "is_active": user.is_active,
                "photo": doctor.photo,
                "pricing": doctor.pricing or 0.0        # ⬅️ new
            }), 200

        if request.method == 'POST':
            data = request.form
            name = data.get('name')
            specialization = data.get('specialization')
            availability = data.get('availability')
            pricing_str = data.get('pricing')
            photo = request.files.get('photo')

            if name:
                doctor.name = name
            if specialization:
                doctor.specialization = specialization
            if availability:
                try:
                    json.loads(availability)
                    doctor.availability = availability
                except json.JSONDecodeError:
                    return jsonify({"error": "Invalid availability format"}), 400
            if pricing_str is not None:
                try:
                    doctor.pricing = float(pricing_str)
                except ValueError:
                    return jsonify({"error": "Invalid price format"}), 400
            if photo and photo.filename:
                if not (photo.filename.lower().endswith(('.jpg', '.jpeg', '.png'))):
                    return jsonify({"error": "Photo must be JPG, JPEG, or PNG"}), 400
                filename = secure_filename(photo.filename)
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                photo.save(file_path)
                doctor.photo = filename

            db.session.commit()
            print(f"Doctor profile updated: {doctor.name}, pricing: {doctor.pricing}")
            return jsonify({"message": "Profile updated successfully"}), 200

    except Exception as e:
        print(f"Error managing profile: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to manage profile"}), 500
@bp.route('/doctor/toggle-instant', methods=['POST'])
@jwt_required()
def toggle_instant():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'doctor':
            print("Unauthorized access to toggle instant")
            return jsonify({"error": "Doctor access required"}), 403

        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            return jsonify({"error": "Doctor not found"}), 404

        doctor.instant_available = not doctor.instant_available
        db.session.commit()
        print(f"Instant availability toggled to: {doctor.instant_available}")
        return jsonify({"message": "Instant availability updated", "instant_available": doctor.instant_available}), 200
    
    except Exception as e:
        print(f"Error toggling instant availability: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to toggle instant availability"}), 500

@bp.route('/doctor/toggle-active', methods=['POST'])
@jwt_required()
def toggle_active():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'doctor':
            print("Unauthorized access to toggle active")
            return jsonify({"error": "Doctor access required"}), 403

        user.is_active = not user.is_active
        db.session.commit()
        print(f"Active status toggled to: {user.is_active}")
        return jsonify({"message": "Active status updated", "is_active": user.is_active}), 200
    
    except Exception as e:
        print(f"Error toggling active status: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to toggle active status"}), 500

@bp.route('/doctor/available-slots/<int:doctor_id>', methods=['GET'])
def get_available_slots(doctor_id):
    try:
        doctor = Doctor.query.get_or_404(doctor_id)
        if not doctor.availability:
            return jsonify({"slots": {}}), 200

        availability = json.loads(doctor.availability)
        appointments = Appointment.query.filter_by(doctor_id=doctor_id, status='accepted').all()
        booked_slots = []
        for appt in appointments:
            booked_slots.append({
                "start": appt.start_time,
                "end": appt.end_time
            })

        available_slots = {}
        for day, time_ranges in availability.items():
            available_slots[day] = []
            for time_range in time_ranges:
                start, end = time_range.split('-')
                start_time = datetime.strptime(start, '%H:%M')
                end_time = datetime.strptime(end, '%H:%M')
                current = start_time
                while current < end_time:
                    slot_start = current
                    slot_end = (datetime.combine(datetime.today(), current.time()) + timedelta(minutes=25)).time()
                    if slot_end > end_time.time():
                        break
                    slot_available = True
                    for booked in booked_slots:
                        booked_start = booked["start"]
                        booked_end = booked["end"]
                        slot_start_dt = datetime.combine(datetime.today(), slot_start.time())
                        slot_end_dt = datetime.combine(datetime.today(), slot_end)
                        if (slot_start_dt < booked_end and slot_end_dt > booked_start):
                            slot_available = False
                            break
                    if slot_available:
                        available_slots[day].append(f"{slot_start.strftime('%H:%M')}-{slot_end.strftime('%H:%M')}")
                    current = (datetime.combine(datetime.today(), current.time()) + timedelta(minutes=25)).time()
        return jsonify({"slots": available_slots}), 200
    
    except Exception as e:
        print(f"Error fetching available slots: {e}")
        return jsonify({"error": "Failed to fetch available slots"}), 500

@bp.route('/patient/doctors', methods=['GET'])
@jwt_required()
def get_approved_doctors():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'patient':
            return jsonify({"error": "Patient access required"}), 403

        doctors = Doctor.query.filter_by(is_approved=True).all()
        doctors_list = [
            {
                "id": doctor.id,
                "name": doctor.name,
                "specialization": doctor.specialization,
                "instant_available": doctor.instant_available,
                "is_active": doctor.user.is_active,
                # REMOVE: "is_online": doctor.is_online,
                "availability": json.loads(doctor.availability) if doctor.availability else {},
                "photo": doctor.photo or None,
            }
            for doctor in doctors if doctor.user.is_active
        ]
        return jsonify({"doctors": doctors_list}), 200
    except Exception as e:
        print(f"Error fetching doctors: {e}")
        return jsonify({"error": "Failed to fetch doctors"}), 500
    
@bp.route('/patient/book-appointment', methods=['POST'])
@jwt_required()
def book_appointment():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'patient':
            return jsonify({"error": "Patient access required"}), 403

        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404

        data = request.form
        doctor_id        = int(data.get('doctor_id'))
        appointment_type = data.get('appointment_type')
        start_time_str   = data.get('start_time')   
        end_time_str     = data.get('end_time')     
        symptoms         = data.get('symptoms')
        report_file      = request.files.get('report_file')

        
        if not all([doctor_id, appointment_type, start_time_str, end_time_str, symptoms]):
            return jsonify({"error": "Missing required fields"}), 400

        doctor = Doctor.query.get_or_404(doctor_id)
        if not doctor.is_approved or not doctor.user.is_active:
            return jsonify({"error": "Doctor not available"}), 403

        if appointment_type == 'emergency' and not doctor.instant_available:
            return jsonify({"error": "Doctor not available for instant appointments"}), 403

        
        try:
            day, slot = start_time_str.split(' ', 1)
            start_h, start_m = map(int, slot.split('-')[0].split(':'))
            end_h, end_m     = map(int, slot.split('-')[1].split(':'))
            now = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            start_dt = now + timedelta(hours=start_h, minutes=start_m)
            end_dt   = now + timedelta(hours=end_h, minutes=end_m)
        except Exception:
            return jsonify({"error": "Invalid slot format"}), 400

        
        if start_dt >= end_dt:
            return jsonify({"error": "End time must be after start time"}), 400

        
        overlap = Appointment.query.filter(
            Appointment.doctor_id == doctor_id,
            Appointment.status == 'accepted',
            Appointment.start_time < end_dt,
            Appointment.end_time > start_dt
        ).first()
        if overlap:
            return jsonify({"error": "Time slot already taken"}), 400

        
        report_path = None
        if report_file and report_file.filename:
            if not report_file.filename.lower().endswith(('.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png')):
                return jsonify({"error": "Unsupported file type"}), 400
            fn = secure_filename(report_file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], fn)
            report_file.save(file_path)
            report_path = fn

        
        appointment = Appointment(
            patient_id=patient.id,
            doctor_id=doctor_id,
            appointment_type=appointment_type,
            start_time=start_dt,
            end_time=end_dt,
            status='pending' if appointment_type == 'normal' else 'accepted',
            symptoms=symptoms,
            report_file=report_path
        )
        db.session.add(appointment)
        db.session.commit()
        return jsonify({"message": "Appointment booked successfully"}), 201
    except Exception as e:
        db.session.rollback()
        print("Booking error:", e)
        return jsonify({"error": "Internal server error"}), 500
    
@bp.route('/patient/appointments', methods=['GET'])
@jwt_required()
def get_patient_appointments():
    try:
        user_id = int(get_jwt_identity())
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404

        
        rows = (
            db.session.query(Appointment, Doctor, Patient)
            .join(Doctor, Appointment.doctor_id == Doctor.id)
            .join(Patient, Appointment.patient_id == Patient.id)
            .filter(Patient.id == patient.id)
            .all()
        )

        result = [
            {
                "id": appt.id,
                "doctor_name": doctor.name,
                "appointment_type": appt.appointment_type,
                "start_time": appt.start_time.isoformat(),
                "end_time": appt.end_time.isoformat(),
                "status": appt.status,
                "symptoms": appt.symptoms,
                "report_file": appt.report_file
            }
            for appt, doctor, _ in rows
        ]
        return jsonify({"appointments": result}), 200
    except Exception as e:
        print("Patient appointments error:", e)
        return jsonify({"error": "Failed to fetch appointments"}), 500

@bp.route('/patient/profile', methods=['GET', 'POST'])
@jwt_required()
def manage_patient_profile():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'patient':
            print("Unauthorized access to patient profile")
            return jsonify({"error": "Patient access required"}), 403

        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404

        if request.method == 'GET':
            return jsonify({
                "user_id": user.id,  
                "name": patient.name,
                "email": user.email,
                "age": patient.age,
                "gender": patient.gender,
                "medical_history": patient.medical_history
            }), 200

        if request.method == 'POST':
            data = request.get_json()
            name = data.get('name')
            age = data.get('age')
            gender = data.get('gender')
            medical_history = data.get('medical_history')

            if name:
                patient.name = name
            if age:
                patient.age = int(age)
            if gender:
                patient.gender = gender
            if medical_history:
                patient.medical_history = medical_history

            db.session.commit()
            print(f"Patient profile updated: {patient.name}")
            return jsonify({"message": "Profile updated successfully"}), 200
    
    except Exception as e:
        print(f"Error managing patient profile: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to manage profile"}), 500

@bp.route('/patient/book-instant-appointment', methods=['POST'])
@jwt_required()
def book_instant_appointment():
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if not user or user.role != 'patient':
            return jsonify({"error": "Patient access required"}), 403

        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            return jsonify({"error": "Patient not found"}), 404

        data = request.form
        doctor_id = int(data.get('doctor_id'))
        symptoms = data.get('symptoms')
        report_file = request.files.get('report_file')

        if not all([doctor_id, symptoms]):
            return jsonify({"error": "Missing required fields"}), 400

        doctor = Doctor.query.get_or_404(doctor_id)
        if not doctor.is_approved or not doctor.user.is_active or not doctor.instant_available:
            return jsonify({"error": "Doctor not available for instant consultation"}), 403

        report_path = None
        if report_file and report_file.filename:
            if not report_file.filename.lower().endswith(('.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png')):
                return jsonify({"error": "Unsupported file type"}), 400
            fn = secure_filename(report_file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], fn)
            report_file.save(file_path)
            report_path = fn

        now = datetime.utcnow()
        appointment = Appointment(
            patient_id=patient.id,
            doctor_id=doctor_id,
            appointment_type='instant',
            start_time=now,
            end_time=now + timedelta(hours=1),
            status='pending',
            symptoms=symptoms,
            report_file=report_path
        )
        db.session.add(appointment)
        db.session.commit()

        from app import socketio
        socketio.emit('new_appointment_request', {
            'appointment': {
                'id': appointment.id,
                'patient_name': patient.name,
                'symptoms': appointment.symptoms,
                'appointment_type': appointment.appointment_type,
                'start_time': appointment.start_time.isoformat(),
                'end_time': appointment.end_time.isoformat(),
                'patient': {
                    'id': patient.id,
                    'name': patient.name,
                    'age': patient.age,
                    'gender': patient.gender,
                    'medical_history': patient.medical_history
                }
            }
        }, room=f'doctor_{doctor_id}')

        return jsonify({"message": "Instant appointment request sent", "appointment_id": appointment.id}), 201
        
    except Exception as e:
        db.session.rollback()
        print("Instant booking error:", e)
        return jsonify({"error": "Internal server error"}), 500
    

@bp.route('/debug/appointment/<int:appointment_id>', methods=['GET'])
def debug_appointment(appointment_id):
    try:
        appointment = Appointment.query.get(appointment_id)
        if not appointment:
            return jsonify({"error": "Appointment not found"}), 404
            
        patient = Patient.query.get(appointment.patient_id)
        doctor = Doctor.query.get(appointment.doctor_id)
        
        return jsonify({
            "appointment_id": appointment_id,
            "patient_id": appointment.patient_id,
            "patient_user_id": patient.user_id if patient else None,
            "patient_name": patient.name if patient else None,
            "doctor_id": appointment.doctor_id,
            "doctor_user_id": doctor.user_id if doctor else None,
            "doctor_name": doctor.name if doctor else None,
            "should_emit_to_room": f"patient_{patient.user_id}" if patient else None
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

    
print("All routes defined")
