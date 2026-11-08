import type { TranslationKey } from '@aloha/i18n';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { AuthFormScreen } from '@/components/auth/auth-form-screen';
import { SwitchPrompt } from '@/components/auth/switch-prompt';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { space } from '@/constants/theme';
import { useT } from '@/hooks/use-t';
import { isValidEmail, signIn } from '@/lib/auth';

type Errors = { email?: TranslationKey; password?: TranslationKey };

export default function SignInScreen() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  const onSubmit = async () => {
    const next: Errors = {
      email: isValidEmail(email) ? undefined : 'authErrors.emailInvalid',
      password: password ? undefined : 'authErrors.passwordRequired',
    };
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    setFormError(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    // Po sukcesie nawigator sam przełącza na aplikację (zmiana sesji).
    if (!result.ok) setFormError(result.error);
  };

  return (
    <AuthFormScreen
      title={t('signIn.title')}
      subtitle={t('signIn.subtitle')}
      footer={
        <SwitchPrompt
          prompt={t('signIn.switchPrompt')}
          action={t('signIn.switchAction')}
          onPress={() => router.replace('/sign-up')}
        />
      }>
      <View style={styles.fields}>
        <TextField
          label={t('signIn.emailLabel')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setErrors((e) => ({ ...e, email: undefined }));
            setFormError(null);
          }}
          error={errors.email && t(errors.email)}
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <View style={styles.passwordGroup}>
          <TextField
            ref={passwordRef}
            label={t('signIn.passwordLabel')}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrors((e) => ({ ...e, password: undefined }));
              setFormError(null);
            }}
            error={errors.password && t(errors.password)}
            secure
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <View style={styles.forgot}>
            <Button
              variant="plain"
              label={t('signIn.forgot')}
              onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
            />
          </View>
        </View>
      </View>

      {formError ? <Notice message={t(formError)} /> : null}

      <Button label={t('signIn.submit')} loading={submitting} onPress={onSubmit} />
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space[4] },
  passwordGroup: { gap: space[1] },
  forgot: { alignItems: 'flex-end', marginRight: -space[2] },
});
