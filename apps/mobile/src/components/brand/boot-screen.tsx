import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { SunriseMark } from '@/components/brand/sunrise-mark';
import { WaveBand } from '@/components/brand/wave-band';
import { FadeUp } from '@/components/ui/fade-up';
import { colors } from '@/constants/theme';
import { useT } from '@/hooks/use-t';

/** Rozmiar znaku jak na natywnym splashu (`imageWidth` w app.json) – znak nie przeskakuje przy podmianie. */
const MARK_SIZE = 76;

/**
 * Ekran startowy po natywnym splashu: to samo turkusowe tło i znak w tym samym miejscu, tylko słońce
 * wschodzi zza fali i „oddycha”, dopóki aplikacja zbiera dane. Kolory zawsze z trybu jasnego – jak splash.
 */
export function BootScreen() {
  const t = useT();
  const { width } = useWindowDimensions();
  const c = colors.light;
  return (
    <View
      style={[styles.fill, { backgroundColor: c.surfaceBrand }]}
      accessible
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}>
      <SunriseMark size={MARK_SIZE} delay={0} scheme="light" />
      <FadeUp delay={200} distance={0} style={styles.waves}>
        <WaveBand
          width={width}
          layers={[
            { color: c.textOnBrand, opacity: 0.08, mid: 22, amp: 12, durationMs: 16000, reverse: true },
            { color: c.textOnBrand, opacity: 0.12, mid: 34, amp: 11, durationMs: 11000 },
          ]}
        />
      </FadeUp>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waves: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
