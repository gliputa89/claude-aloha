import type { TranslationKey } from '@aloha/i18n';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { EnvelopeSimple } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { AuthFormScreen } from '@/components/auth/auth-form-screen';
import { SwitchPrompt } from '@/components/auth/switch-prompt';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { radius, space } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { isValidEmail, MIN_PASSWORD_LENGTH, signUp } from '@/lib/auth';
import { legalUrl } from '@/lib/links';

type Field = 'name' | 'email' | 'password' | 'adult' | 'terms';
type Errors = Partial<Record<Field, TranslationKey>>;

export default function SignUpScreen() {
  const t = useT();
  const c = useColors();
  const locale = useLocale();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const clear = (field: Field) => {
    setErrors((e) => ({ ...e, [field]: undefined }));
    setFormError(null);
  };

  const validate = (): Errors => ({
    name: name.trim() ? undefined : 'authErrors.nameRequired',
    email: isValidEmail(email) ? undefined : 'authErrors.emailInvalid',
    password: password.length >= MIN_PASSWORD_LENGTH ? undefined : 'authErrors.passwordShort',
    adult: adult ? undefined : 'authErrors.adultRequired',
    terms: terms ? undefined : 'authErrors.termsRequired',
  });

  const onSubmit = async () => {
    const next = validate();
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setFormError(null);
    const result = await signUp({ name, email, password, locale });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    // Bez potwierdzania e-maila sesja jest od razu – nawigator sam przełączy na aplikację.
    if (result.data.needsConfirmation) setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <AuthFormScreen title={t('signUp.checkEmailTitle')}>
        <View style={[styles.sentIcon, { backgroundColor: c.surfaceBrandSoft }]}>
          <EnvelopeSimple size={36} weight="bold" color={c.textBrand} />
        </View>
        <Text>{t('signUp.checkEmailBody', { email: sentTo })}</Text>
        <Button label={t('signUp.checkEmailAction')} onPress={() => router.replace('/sign-in')} />
      </AuthFormScreen>
    );
  }

  const termsA11y = `${t('signUp.termsPrefix')}${t('signUp.termsLink')}${t('signUp.termsJoin')}${t('signUp.privacyLink')}`;
  const openLegal = (doc: 'terms' | 'privacy') => WebBrowser.openBrowserAsync(legalUrl(doc, locale));

  return (
    <AuthFormScreen
      title={t('signUp.title')}
      subtitle={t('signUp.subtitle')}
      footer={
        <SwitchPrompt
          prompt={t('signUp.switchPrompt')}
          action={t('signUp.switchAction')}
          onPress={() => router.replace('/sign-in')}
        />
      }>
      <View style={styles.fields}>
        <TextField
          label={t('signUp.nameLabel')}
          placeholder={t('signUp.namePlaceholder')}
          value={name}
          onChangeText={(v) => {
            setName(v);
            clear('name');
          }}
          error={errors.name && t(errors.name)}
          autoComplete="given-name"
          textContentType="givenName"
          autoCapitalize="words"
          returnKeyType="next"
          maxLength={80}
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <TextField
          ref={emailRef}
          label={t('signUp.emailLabel')}
          placeholder={t('signUp.emailPlaceholder')}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            clear('email');
          }}
          error={errors.email && t(errors.email)}
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <TextField
          ref={passwordRef}
          label={t('signUp.passwordLabel')}
          hint={t('signUp.passwordHint')}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clear('password');
          }}
          error={errors.password && t(errors.password)}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>

      <View style={styles.checks}>
        <Checkbox
          checked={adult}
          onChange={(v) => {
            setAdult(v);
            clear('adult');
          }}
          label={t('signUp.adult')}
          invalid={!!errors.adult}
        />
        <Checkbox
          checked={terms}
          onChange={(v) => {
            setTerms(v);
            clear('terms');
          }}
          accessibilityLabel={termsA11y}
          invalid={!!errors.terms}
          label={
            <Text>
              {t('signUp.termsPrefix')}
              <Text color="textBrand" weight="semibold" accessibilityRole="link" onPress={() => openLegal('terms')}>
                {t('signUp.termsLink')}
              </Text>
              {t('signUp.termsJoin')}
              <Text color="textBrand" weight="semibold" accessibilityRole="link" onPress={() => openLegal('privacy')}>
                {t('signUp.privacyLink')}
              </Text>
            </Text>
          }
        />
        {errors.adult || errors.terms ? (
          <Notice message={t((errors.adult ?? errors.terms) as TranslationKey)} />
        ) : null}
      </View>

      {formError ? <Notice message={t(formError)} /> : null}

      <Button label={t('signUp.submit')} loading={submitting} onPress={onSubmit} />
    </AuthFormScreen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space[4] },
  checks: { gap: space[1] },
  sentIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
