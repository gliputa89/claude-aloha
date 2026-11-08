import type { TranslationKey } from '@aloha/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AuthFormScreen } from '@/components/auth/auth-form-screen';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/hooks/use-t';
import { isValidEmail, sendPasswordReset } from '@/lib/auth';

export default function ForgotPasswordScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!isValidEmail(email)) {
      setError('authErrors.emailInvalid');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await sendPasswordReset(email);
    setSubmitting(false);
    if (result.ok) setSentTo(email.trim());
    else setFormError(result.error);
  };

  if (sentTo) {
    return (
      <AuthFormScreen title={t('forgotPassword.sentTitle')}>
        <Text>{t('forgotPassword.sentBody', { email: sentTo })}</Text>
        <Button label={t('forgotPassword.backToSignIn')} onPress={() => router.back()} />
      </AuthFormScreen>
    );
  }

  return (
    <AuthFormScreen title={t('forgotPassword.title')} subtitle={t('forgotPassword.subtitle')}>
      <TextField
        label={t('forgotPassword.emailLabel')}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(null);
          setFormError(null);
        }}
        error={error ? t(error) : undefined}
        autoFocus={!email}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={onSubmit}
      />
      {formError ? <Notice message={t(formError)} /> : null}
      <Button label={t('forgotPassword.submit')} loading={submitting} onPress={onSubmit} />
    </AuthFormScreen>
  );
}
