import re
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Q
from rest_framework import serializers
from .models import User


def phone_value(value, user=None):
    value = re.sub(r'[\s.()-]', '', value or '')
    if not re.fullmatch(r'\+?[0-9]{9,15}', value):
        raise serializers.ValidationError('Số điện thoại phải có 9–15 chữ số.')
    matches = User.objects.filter(Q(phone=value) | Q(username=value))
    if user:
        matches = matches.exclude(pk=user.pk)
    if matches.exists():
        raise serializers.ValidationError('Số điện thoại này đã được sử dụng.')
    return value


def email_value(value, user=None):
    value = (value or '').strip().lower()
    matches = User.objects.filter(email__iexact=value)
    if user:
        matches = matches.exclude(pk=user.pk)
    if value and matches.exists():
        raise serializers.ValidationError('Email này đã được sử dụng.')
    return value


def password_value(value, user=None):
    if len(value) < 8:
        raise serializers.ValidationError('Mật khẩu phải có ít nhất 8 ký tự.')
    try:
        validate_password(value, user)
    except ValidationError as exc:
        raise serializers.ValidationError(exc.messages)
    return value
