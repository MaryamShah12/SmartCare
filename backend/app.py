from flask import Flask, request, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import datetime
from config import Config
from models import db, Doctor
import os
import threading
import time

app = Flask(__name__)
app.config.from_object(Config)


os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


db.init_app(app)
jwt = JWTManager(app)
CORS(app, origins=["http://localhost:3000"])


socketio = SocketIO(
    app, 
    cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    async_mode='threading',
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    allow_upgrades=True
)


@app.before_request
def handle_preflight():
    print(f"Before request: {request.method} {request.path} from {request.headers.get('Origin')}")
    if request.method == "OPTIONS":
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response


@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin in ['http://localhost:3000', 'http://127.0.0.1:3000']:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
        response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'

    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Credentials'] = 'true'

    
    print(f"After request: {request.method} {request.path} - Status: {response.status_code}")
    if response.status_code >= 400:
        print(f"Error Response: {response.status_code} - {response.get_data(as_text=True)}")

    return response


with app.app_context():
    try:
        db.engine.connect()
        print("Connected to database:", app.config['SQLALCHEMY_DATABASE_URI'])
        
        db.create_all()
        print("Database tables created successfully")
    except Exception as e:
        print(f"Database Error: {e}")


from routes import bp as auth_bp
app.register_blueprint(auth_bp)


from socket_handlers import init_socket_handlers
init_socket_handlers(socketio, app, {}, {})

# Print all registered routes for debugging
print("\n=== REGISTERED ROUTES ===")
for rule in app.url_map.iter_rules():
    print(f"{rule.endpoint}: {rule.rule} [{', '.join(rule.methods)}]")
print("========================\n")


@app.errorhandler(500)
def internal_error(error):
    print(f"500 Error: {error}")
    response = make_response({"error": "Internal server error"}, 500)
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    return response

@app.errorhandler(404)
def not_found(error):
    print(f"404 Error: {error}")
    print(f"Requested URL: {request.url}")
    response = make_response({"error": "Not found"}, 404)
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    return response

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=8000)