// Состояние приложения
let socket = null;
let currentUser = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('Страница загружена');
    checkAuth();
    setupEventListeners();
});

function setupEventListeners() {
    // Форма входа
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        login();
    });
    
    // Форма регистрации
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        register();
    });
    
    // Отправка по Enter
    document.getElementById('message-text').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendTextMessage();
        }
    });
}

// Проверка авторизации
function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('Найден сохраненный пользователь:', currentUser);
            showChat();
            connectSocket();
        } catch (e) {
            console.error('Ошибка при загрузке пользователя:', e);
        }
    }
}

// Функции авторизации
function showLogin() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.querySelector('.tab-btn').classList.add('active');
    document.getElementById('login-form').classList.add('active');
}

function showRegister() {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('register-form').classList.add('active');
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    console.log('Попытка входа:', username);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        const data = await response.json();
        console.log('Ответ сервера:', data);
        
        if (data.success) {
            currentUser = data;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showChat();
            connectSocket();
        } else {
            document.getElementById('login-error').textContent = data.error;
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('login-error').textContent = 'Ошибка соединения с сервером';
    }
}

async function register() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    
    console.log('Попытка регистрации:', username);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, email, password})
        });
        
        const data = await response.json();
        console.log('Ответ сервера:', data);
        
        if (data.success) {
            alert('Регистрация успешна! Теперь войдите в систему.');
            showLogin();
        } else {
            document.getElementById('reg-error').textContent = data.error;
        }
    } catch (error) {
        console.error('Register error:', error);
        document.getElementById('reg-error').textContent = 'Ошибка соединения с сервером';
    }
}

function logout() {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('chat-screen').classList.remove('active');
}

function showChat() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('chat-screen').classList.add('active');
    document.getElementById('current-user').textContent = currentUser.username;
}

// WebSocket соединение
function connectSocket() {
    console.log('Подключение к сокету...');
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('user_online', {username: currentUser.username});
        socket.emit('get_messages');
    });
    
    socket.on('users_online', (users) => {
        console.log('Users online:', users);
        updateOnlineUsers(users);
    });
    
    socket.on('new_message', (message) => {
        console.log('New message:', message);
        displayMessage(message);
    });
    
    socket.on('all_messages', (messages) => {
        console.log('All messages:', messages);
        document.getElementById('messages-container').innerHTML = '';
        messages.forEach(message => displayMessage(message));
    });
}

function updateOnlineUsers(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';
    users.filter(u => u !== currentUser.username).forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        li.onclick = () => startPrivateChat(user);
        usersList.appendChild(li);
    });
}

// Отправка сообщений
function sendTextMessage() {
    const input = document.getElementById('message-text');
    const text = input.value.trim();
    
    if (text && socket && currentUser) {
        console.log('Sending message:', text);
        socket.emit('send_message', {
            sender: currentUser.username,
            text: text
        });
        input.value = '';
    }
}

function sendPhoto() {
    const input = document.getElementById('file-input');
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await uploadAndSendFile(file, 'photo');
        }
    };
    input.click();
}

function sendVideo() {
    const input = document.getElementById('file-input');
    input.accept = 'video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await uploadAndSendFile(file, 'video');
        }
    };
    input.click();
}

function sendVoice() {
    alert('Функция голосовых сообщений будет добавлена позже');
}

async function uploadAndSendFile(file, type) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        console.log('Upload response:', data);
        
        if (data.success && socket) {
            socket.emit('send_message', {
                sender: currentUser.username,
                file_url: data.file_url,
                file_type: type
            });
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Ошибка при загрузке файла');
    }
}

function displayMessage(message) {
    const container = document.getElementById('messages-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === currentUser?.username ? 'sent' : 'received'}`;
    
    let content = '';
    const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    if (message.text) {
        content = `<div class="message-content">${message.text}</div>`;
    } else if (message.file_url) {
        if (message.file_type === 'photo') {
            content = `<img src="${message.file_url}" class="message-media" onclick="window.open('${message.file_url}')">`;
        } else if (message.file_type === 'video') {
            content = `<video src="${message.file_url}" class="message-media" controls></video>`;
        } else if (message.file_type === 'voice') {
            content = `<audio src="${message.file_url}" controls></audio>`;
        }
    }
    
    messageDiv.innerHTML = `
        <div class="message-info">
            <span class="sender">${message.sender}</span>
            <span class="time">${time}</span>
        </div>
        ${content}
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function startPrivateChat(username) {
    alert(`Чат с ${username} будет доступен в следующей версии`);
}