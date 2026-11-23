import { footnoteTarget, splitForHighlight, type Block, type Run } from '@tehqeqat/core';
import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { openExternal } from '@/lib/open-external';
import { useColors } from '@/providers/app-providers';
import { space } from '@/theme/tokens';
import { useTypography } from '@/theme/typography';

interface Props {
  blocks: readonly Block[];
  /** Normalised search tokens to highlight. */
  tokens?: readonly string[];
  /** Reading size before the text scale (the scale is applied here). */
  size?: number;
  onFootnote?: (id: string, label: string) => void;
}

/** Word HTML, parsed by @tehqeqat/core, as native text: no WebView, selectable, RTL. */
export const RichText = memo(function RichText({ blocks, tokens, size = 19, onFootnote }: Props) {
  const { colors } = useColors();
  const typo = useTypography();
  const fontSize = size * typo.textScale;

  const renderRun = (run: Run, key: string): ReactNode => {
    const style: TextStyle[] = [typo.script(run.script, fontSize)];
    if (run.bold) style.push(styles.bold);
    if (run.italic) style.push(styles.italic);
    if (run.underline) style.push(styles.underline);
    const footnote = footnoteTarget(run.href);
    if (run.sup || footnote) {
      style.push({ fontSize: fontSize * 0.62, color: colors.primary });
    }
    if (footnote && onFootnote) {
      return (
        <Text
          key={key}
          style={style}
          onPress={() => onFootnote(footnote, run.text.replace(/[[\]\s]/g, ''))}
          accessibilityRole="link"
          suppressHighlighting>
          {run.text}
        </Text>
      );
    }
    if (run.href && /^https?:/.test(run.href)) {
      const href = run.href;
      return (
        <Text key={key} style={[...style, { color: colors.primary }]} onPress={() => openExternal(href)}>
          {run.text}
        </Text>
      );
    }
    if (tokens && tokens.length > 0) {
      const segs = splitForHighlight(run.text, tokens);
      if (segs.length > 1 || segs[0]?.hit) {
        return (
          <Text key={key} style={style}>
            {segs.map((s, i) =>
              s.hit ? (
                <Text key={i} style={{ backgroundColor: colors.highlight, color: colors.highlightText }}>
                  {s.text}
                </Text>
              ) : (
                s.text
              ),
            )}
          </Text>
        );
      }
    }
    return (
      <Text key={key} style={style}>
        {run.text}
      </Text>
    );
  };

  return (
    <View style={styles.blocks}>
      {blocks.map((b, i) => (
        <Text
          key={i}
          selectable
          style={[
            styles.block,
            typo.script('urdu', fontSize),
            { color: colors.text },
            b.heading && { color: colors.primary, fontSize: fontSize * 1.05 },
          ]}>
          {b.runs.map((r, j) => renderRun(r, `${i}-${j}`))}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  blocks: { gap: space.sm },
  block: { writingDirection: 'rtl', textAlign: 'justify', paddingTop: 2 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
});
