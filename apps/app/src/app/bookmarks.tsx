import { HadithList } from '@/components/hadith/hadith-list';
import { EmptyState } from '@/components/ui/states';
import { useBookmarks } from '@/hooks/queries';
import { useT } from '@/providers/app-providers';

export default function BookmarksScreen() {
  const { t } = useT();
  const marks = useBookmarks();
  return (
    <HadithList
      items={marks.data}
      loading={marks.isPending}
      error={marks.error}
      onRetry={() => void marks.refetch()}
      empty={
        <EmptyState
          icon={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }}
          title={t('bookmarks.empty')}
          hint={t('bookmarks.emptyHint')}
        />
      }
    />
  );
}
