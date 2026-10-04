"""Isolated SQLite settings: never connect to the configured Supabase database."""
SECRET_KEY = 'isolated-test-key-not-for-deployment'
DEBUG = False
USE_TZ = True
ROOT_URLCONF = 'sentinel.urls'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'accounts.User'
ALLOWED_HOSTS = ['testserver', 'localhost']
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions',
    'django.contrib.messages', 'django.contrib.admin', 'accounts', 'rescue_operations', 'reporting', 'communications', 'ai']
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
MIDDLEWARE = ['django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware']
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'APP_DIRS': True,
    'OPTIONS': {'context_processors': ['django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages', 'django.template.context_processors.request']}}]
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': ['accounts.authentication.AccountJWTAuthentication']}
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
DEFAULT_FROM_EMAIL = 'test@example.com'
PASSWORD_RESET_TIMEOUT = 15 * 60
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
MEDIA_URL = '/media/'
MEDIA_ROOT = ''
