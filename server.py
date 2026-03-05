# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_socketio import SocketIO, emit
import json, os, uuid
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey'
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024

socketio = SocketIO(app, cors_allowed_origins="*")

BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER  = os.path.join(BASE_DIR, 'uploads')
PHOTO_FOLDER   = os.path.join(UPLOAD_FOLDER, 'photos')
VIDEO_FOLDER   = os.path.join(UPLOAD_FOLDER, 'videos')
DATABASE_FOLDER = os.path.join(BASE_DIR, 'database')
USERS_FILE     = os.path.join(DATABASE_FOLDER, 'users.json')

os.makedirs(PHOTO_FOLDER,    exist_ok=True)
os.makedirs(VIDEO_FOLDER,    exist_ok=True)
os.makedirs(DATABASE_FOLDER, exist_ok=True)

active_users     = {}
general_messages = []
private_messages = {}

def get_chat_id(u1, u2):
    return '__'.join(sorted([u1, u2]))

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    email    = data.get('email', '').strip()
    if not username or not password:
        return jsonify({'success': False, 'error': 'Заполните все поля'})
    if '__' in username:
        return jsonify({'success': False, 'error': 'Имя не может содержать __'})
    users = load_users()
    if username in users:
        return jsonify({'success': False, 'error': 'Имя уже занято'})
    users[username] = {'password': password, 'email': email, 'created_at': datetime.now().isoformat()}
    save_users(users)
    return jsonify({'success': True, 'username': username})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = (data.get('username') or '').strip()
    password = data.get('password', '')
    users = load_users()
    if username in users and users[username]['password'] == password:
        return jsonify({'success': True, 'username': username})
    return jsonify({'success': False, 'error': 'Неверное имя или пароль'})

@app.route('/api/users', methods=['GET'])
def get_users():
    return jsonify(list(load_users().keys()))

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'Нет файла'})
    file = request.files['file']
    file_type = request.form.get('type', 'photo')
    if not file.filename:
        return jsonify({'success': False, 'error': 'Файл не выбран'})
    folder = PHOTO_FOLDER if file_type == 'photo' else VIDEO_FOLDER
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'bin'
    filename = f"{uuid.uuid4()}.{ext}"
    file.save(os.path.join(folder, filename))
    return jsonify({'success': True, 'file_url': f'/uploads/{file_type}s/{filename}'})

@app.route('/uploads/<folder>/<filename>')
def get_upload(folder, filename):
    return send_from_directory(os.path.join(UPLOAD_FOLDER, folder), filename)

@socketio.on('connect')
def handle_connect():
    print(f'Подключен: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    for username, sid in list(active_users.items()):
        if sid == request.sid:
            del active_users[username]
            emit('users_online', list(active_users.keys()), broadcast=True)
            print(f'{username} отключился')
            break

@socketio.on('user_online')
def handle_user_online(data):
    username = data.get('username', '').strip()
    if username:
        active_users[username] = request.sid
        emit('users_online', list(active_users.keys()), broadcast=True)

@socketio.on('send_message')
def handle_message(data):
    sender    = data.get('sender', '').strip()
    text      = data.get('text', '')
    file_url  = data.get('file_url')
    file_type = data.get('file_type')
    recipient = data.get('recipient', 'all')
    is_private = recipient not in ('all', sender, '')

    message = {
        'id':        str(uuid.uuid4()),
        'sender':    sender,
        'text':      text,
        'file_url':  file_url,
        'file_type': file_type,
        'recipient': recipient if is_private else 'all',
        'timestamp': datetime.now().isoformat()
    }

    if not is_private:
        general_messages.append(message)
        emit('new_message', message, broadcast=True)
    else:
        chat_id = get_chat_id(sender, recipient)
        private_messages.setdefault(chat_id, []).append(message)
        if recipient in active_users:
            emit('new_message', message, room=active_users[recipient])
        emit('new_message', message, room=request.sid)

@socketio.on('get_messages')
def handle_get_messages(data=None):
    username = (data or {}).get('username', '').strip()
    user_private = {}
    for chat_id, msgs in private_messages.items():
        parts = chat_id.split('__')
        if len(parts) == 2 and username in parts:
            user_private[chat_id] = msgs

    emit('all_messages', {
        'general': general_messages,
        'private': user_private
    })

if __name__ == '__main__':
    import socket as _socket
    try:
        local_ip = _socket.gethostbyname(_socket.gethostname())
    except:
        local_ip = '127.0.0.1'
    print('=' * 50)
    print(f'  Локальный:  http://localhost:5000')
    print(f'  По WiFi:    http://{local_ip}:5000')
    print('=' * 50)
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)