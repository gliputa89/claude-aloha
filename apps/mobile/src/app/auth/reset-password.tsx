import type { TranslationKey } from '@aloha/i18n';
import { router } from 'expo-router';
import { useState } from 'react';

import { AuthFormScreen } from '@/components/auth/auth-form-screen';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useT } from '@/hooks/use-t';
import { MIN_PASSWORD_LENGTH, updatePassword } from '@/lib/auth';
import { useAuth } from '@/providers/auth-provider';

/** Ustawienie nowego hasła po kliknięciu linku resetu (sesja odzyskiwania z auth/callback). */
export default function ResetPasswordScreen() {
  const t = useT();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!session) {
    return (
      <AuthFormScreen title={t('resetPassword.title')}>
        <Notice message={t('resetPassword.linkExpired')} />
        <Button label={t('resetPassword.requestNew')} onPress={() => router.replace('/forgot-password')} />
      </AuthFormScreen>
    );
  }

  const onSubmit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('authErrors.passwordShort');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.ok) router.replace('/');
    else setFormError(result.error);
  };

  return (
    <AuthFormScreen title={t('resetPassword.title')} subtitle={t('resetPassword.subtitle')}>
      <TextField
        label={t('resetPassword.passwordLabel')}
        hint={t('resetPassword.passwordHint')}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
          setFormError(null);
        }}
        error={error ? t(error) : undefined}
        secure
        autoFocus
        autoComplete="new-password"
        textContentType="newPassword"
        passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      {formError ? <Notice message={t(formError)} /> : null}
      <Button label={t('resetPassword.submit')} loading={submitting} onPress={onSubmit} />
    </AuthFormScreen>
  );
}
