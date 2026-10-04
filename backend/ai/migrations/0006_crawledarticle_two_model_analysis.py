from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('ai', '0005_backfill_news_publication')]
    operations = [
        migrations.AddField(model_name='crawledarticle', name='ai_analysis', field=models.JSONField(default=dict, blank=True)),
        migrations.AddField(model_name='crawledarticle', name='reviewed_analysis', field=models.JSONField(default=dict, blank=True)),
    ]
