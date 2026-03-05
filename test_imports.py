# test_imports.py
try:
    import flask
    print("✅ Flask установлен")
except ImportError:
    print("❌ Flask не установлен")

try:
    import flask_socketio
    print("✅ Flask-SocketIO установлен")
except ImportError:
    print("❌ Flask-SocketIO не установлен")

try:
    import cv2
    print("✅ OpenCV установлен")
except ImportError:
    print("❌ OpenCV не установлен")

try:
    import PIL
    print("✅ Pillow установлен")
except ImportError:
    print("❌ Pillow не установлен")

try:
    import numpy
    print("✅ NumPy установлен")
except ImportError:
    print("❌ NumPy не установлен")

try:
    import pyaudio
    print("✅ PyAudio установлен")
except ImportError:
    print("❌ PyAudio не установлен (можно использовать sounddevice)")
    
print("\n🎉 Все проверки завершены!")