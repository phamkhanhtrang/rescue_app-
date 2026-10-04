from django.db import migrations


def normalize(apps, schema_editor):
    Rescuer = apps.get_model('accounts', 'RescuerProfile')
    Event = apps.get_model('accounts', 'AccountEvent')
    mapping = {'TÌM KIẾM CỨU NẠN': 'SEARCH_RESCUE', 'TÌM KIẾM & CỨU NẠN': 'SEARCH_RESCUE',
               'CỨU HỘ': 'SEARCH_RESCUE', 'CỨU HỘ NƯỚC': 'SEARCH_RESCUE',
               'HỖ TRỢ Y TẾ': 'MEDICAL', 'Y TẾ': 'MEDICAL', 'HẬU CẦN': 'LOGISTICS', 'CHỈ HUY': 'COMMAND'}
    choices = {'SEARCH_RESCUE', 'MEDICAL', 'LOGISTICS', 'COMMAND'}
    for rp in Rescuer.objects.select_related('user').all().iterator():
        if rp.user.is_active:
            rp.status = 'ACTIVE'
        elif rp.status not in ['PENDING', 'REJECTED', 'BANNED']:
            rp.status = 'BANNED'
        raw = (rp.specialty or '').strip().upper()
        first = raw.split(',')[0].strip()
        rp.specialty = raw if raw in choices else mapping.get(first)
        if raw and raw != (rp.specialty or ''):
            Event.objects.create(user_id=rp.user_id, action='normalize_profile',
                                 reason='Chuẩn hóa chuyên môn chính. Giá trị cũ: ' + raw)
        rp.save(update_fields=['status', 'specialty'])


class Migration(migrations.Migration):
    dependencies = [('accounts', '0012_revokedsession')]
    operations = [migrations.RunPython(normalize, migrations.RunPython.noop)]
