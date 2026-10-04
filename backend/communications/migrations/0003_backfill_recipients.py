from django.db import migrations


def backfill(apps, schema_editor):
    Alert = apps.get_model('communications', 'Alert')
    for alert in Alert.objects.all().iterator():
        emergency = (alert.severity or '').upper() in ('CRITICAL', 'HIGH', 'EMERGENCY') or alert.category == 'emergency'
        Alert.objects.filter(pk=alert.pk).update(
            message_type='EMERGENCY' if emergency else 'BROADCAST',
            audience='RESCUER' if alert.category == 'teams' else 'ALL',
            published_at=alert.created_at,
        )


class Migration(migrations.Migration):
    dependencies = [('communications', '0002_alert_audience_alert_expires_at_alert_message_type_and_more')]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
