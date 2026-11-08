import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

type SwitchPromptProps = { prompt: string; action: string; onPress: () => void };

/** „Masz już konto? Zaloguj się” na dole formularza. */
export function SwitchPrompt({ prompt, action, onPress }: SwitchPromptProps) {
  return (
    <View style={styles.row}>
      <Text variant="caption">{prompt}</Text>
      <Button variant="plain" label={action} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
});
