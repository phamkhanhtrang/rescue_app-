from django.db import migrations


def backfill(apps, schema_editor):
    Article = apps.get_model('ai', 'CrawledArticle')
    Article.objects.filter(status__in=['APPROVED', 'ALERT_CREATED']).exclude(source_platform='FACEBOOK').update(is_published=True)
    # Historical publication times are unknown. Never present crawl time as publication time.


class Migration(migrations.Migration):
    dependencies = [('ai', '0004_crawledarticle_is_published_and_more')]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
