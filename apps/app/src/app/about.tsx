import { router } from 'expo-router';
import { openExternal } from '@/lib/open-external';
import { AppText, Card, Group, ListRow, ScreenScroll, UrduText } from '@/components/ui/primitives';
import { useAnnouncements, useChapters } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';

const INTRO_CHAPTER = 'مقدمات-و-تعارف';

export default function AboutScreen() {
  const { t } = useT();
  const announcements = useAnnouncements();
  const chapters = useChapters();
  const intro = chapters.data?.find((c) => c.slug === INTRO_CHAPTER);
  return (
    <ScreenScroll>
      <Card>
        <UrduText size="headline" color="primary">
          {t('appName')}
        </UrduText>
        <AppText>{t('about.body')}</AppText>
      </Card>
      <Group>
        {intro ? (
          <ListRow
            icon={{ ios: 'book', android: 'menu_book', web: 'menu_book' }}
            label={t('about.intro')}
            detail={intro.description ?? undefined}
            onPress={() => router.push({ pathname: '/chapters/[slug]', params: { slug: intro.slug } })}
          />
        ) : null}
        <ListRow
          icon={{ ios: 'globe', android: 'language', web: 'language' }}
          label={t('about.website')}
          detail="tehqeqatehadees.com"
          onPress={() => openExternal('https://tehqeqatehadees.com')}
          last
        />
      </Group>
      {announcements.data && announcements.data.length > 0 ? (
        <Card>
          <AppText variant="caption" color="primary" weight="bold">
            {t('about.contact')}
          </AppText>
          {announcements.data.map((a) => (
            <AppText key={a.id} color="textSecondary">
              {a.text}
            </AppText>
          ))}
        </Card>
      ) : null}
      <AppText variant="caption" color="textMuted">
        {t('about.privacy')}
      </AppText>
    </ScreenScroll>
  );
}
