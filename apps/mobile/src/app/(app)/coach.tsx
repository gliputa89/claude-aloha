import type { TranslationKey } from '@aloha/i18n';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { PaperPlaneRight, UserCircle, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Mark } from '@/components/brand/mark';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { fontFamily, Text } from '@/components/ui/text';
import { font, radius, space } from '@/constants/theme';
import {
  answerProposal,
  fetchNewMessages,
  grantHealthConsent,
  openChat,
  sendChat,
  type ChatError,
  type ChatMessage,
  type Coach,
  type CoachKind,
} from '@/features/chat/api';
import { useModule } from '@/features/modules/use-module';
import { allSessions, usePlan } from '@/features/plan/plan-provider';
import { useColors } from '@/hooks/use-colors';
import { useLocale, useT } from '@/hooks/use-t';
import { useAuth } from '@/providers/auth-provider';

/**
 * Wysokość klawiatury. Arkusz (modal) kończy się na dole ekranu, więc wystarczy podnieść treść o tyle –
 * KeyboardAvoidingView liczy pozycję względem arkusza i zostawiał pole pisania częściowo pod klawiaturą.
 */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Jak często sprawdzamy, czy trener-człowiek odpisał (odpowiedź AI wraca od razu z wysłaniem). */
const HUMAN_POLL_MS = 20_000;

/**
 * Arkusz rozmowy z trenerem: Pan Aloha (AI) albo prawdziwy trener (osobny pakiet). Bez parametrów – rozmowa
 * ogólna; z `sessionId` – wątek przy treningu (pytania przed i po). Trener może zaproponować zmianę w planie –
 * biegacz ją akceptuje albo zostawia plan bez zmian.
 */
export default function CoachChatScreen() {
  const c = useColors();
  const t = useT();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const params = useLocalSearchParams<{ sessionId?: string; coach?: string }>();
  const { state, refresh } = usePlan();
  const { session: authSession } = useAuth();
  const aiEnabled = useModule('coach_chat');
  const humanEnabled = useModule('coach_human');
  const [kind, setKind] = useState<CoachKind>(params.coach === 'human' && humanEnabled ? 'human' : aiEnabled ? 'ai' : 'human');
  const session = params.sessionId && state.kind === 'ready' ? allSessions(state.plan).find((s) => s.id === params.sessionId) : undefined;
  const phase = !session ? 'general' : session.status === 'planned' ? 'before' : 'after';

  const [coach, setCoach] = useState<Coach | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ChatError | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [answering, setAnswering] = useState<number | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  /** Tymczasowe (ujemne) id wiadomości, zanim serwer nada prawdziwe. */
  const tempId = useRef(0);

  // Otwarcie wątku (przy zmianie trenera – innego wątku).
  useEffect(() => {
    let active = true;
    openChat(kind, params.sessionId).then((result) => {
      if (!active) return;
      if ('thread' in result) {
        setCoach(result.coach);
        setThreadId(result.thread.id);
        setMessages(result.messages);
        setError(null);
      } else {
        setCoach(null);
        setThreadId(null);
        setMessages([]);
        setError(result.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [kind, params.sessionId]);

  // Trener-człowiek odpisuje z opóźnieniem – dociągamy nowe wiadomości co jakiś czas.
  const lastId = Math.max(0, ...messages.map((m) => m.id));
  useEffect(() => {
    if (kind !== 'human' || !threadId) return;
    const timer = setInterval(async () => {
      const fresh = await fetchNewMessages(threadId, lastId);
      if (fresh.length > 0) setMessages((all) => [...all, ...fresh.filter((m) => !all.some((x) => x.id === m.id))]);
    }, HUMAN_POLL_MS);
    return () => clearInterval(timer);
  }, [kind, threadId, lastId]);

  // Po otwarciu klawiatury lista ma mniej miejsca – najnowsza wiadomość musi zostać widoczna.
  useEffect(() => {
    if (keyboard > 0) list.current?.scrollToEnd({ animated: true });
  }, [keyboard]);

  const switchCoach = (next: CoachKind) => {
    if (next === kind) return;
    setLoading(true);
    setKind(next);
  };

  const send = async (text: string) => {
    const body = text.trim();
    if (!threadId || sending || body.length === 0) return;
    setSending(true);
    setError(null);
    setDraft('');
    // Wiadomość widać od razu; po odpowiedzi serwera zastępujemy ją zapisaną (z prawdziwym id).
    tempId.current -= 1;
    const pending: ChatMessage = { id: tempId.current, thread_id: threadId, sender: 'user', body, proposal: null, proposal_status: null, created_at: '' };
    setMessages((all) => [...all, pending]);
    const result = await sendChat(threadId, body);
    setMessages((all) => [...all.filter((m) => m.id !== pending.id), ...('messages' in result ? result.messages : [])]);
    if (!('messages' in result)) setDraft(body);
    if (result.error) setError(result.error);
    setSending(false);
  };

  // Rozmowa o zdrowiu wymaga jednorazowej zgody: po „Zgadzam się” zapisujemy ją i wysyłamy tę samą wiadomość.
  const [consenting, setConsenting] = useState(false);
  const agreeAndSend = async () => {
    if (!authSession) return;
    setConsenting(true);
    const granted = await grantHealthConsent(authSession.user.id);
    setConsenting(false);
    if (granted) await send(draft);
    else setError('failed');
  };

  const answer = async (message: ChatMessage, accept: boolean) => {
    setAnswering(message.id);
    const result = await answerProposal(message.id, accept);
    if ('status' in result) {
      setMessages((all) => all.map((m) => (m.id === message.id ? { ...m, proposal_status: result.status } : m)));
      if (result.status === 'accepted') await refresh();
    } else {
      setError(result.error);
    }
    setAnswering(null);
  };

  // Profil trenera w języku aplikacji (angielski tylko gdy jest przetłumaczony).
  const coachTitle = (locale === 'en' ? coach?.title_en : null) ?? coach?.title ?? null;
  const coachHeadline = (locale === 'en' ? coach?.headline_en : null) ?? coach?.headline ?? coach?.bio ?? null;
  const suggestions = [1, 2, 3].map((n) => t(`chat.suggest.${phase}${n}` as TranslationKey));
  const isAi = kind === 'ai';
  const needsConsent = error === 'health_consent';
  const errorText = error && !needsConsent ? t(`chat.error.${error}` as TranslationKey) : null;

  return (
    <View style={[styles.flex, { backgroundColor: c.background, paddingBottom: keyboard }]}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <View style={[styles.grabber, { backgroundColor: c.borderStrong }]} />
        <View style={styles.head}>
          <View style={[styles.avatar, { backgroundColor: c.surfaceBrand }]}>
            {isAi ? (
              <Mark size={26} wave="textOnBrand" />
            ) : coach?.avatar_url ? (
              <Image source={coach.avatar_url} style={styles.photo} contentFit="cover" accessibilityIgnoresInvertColors />
            ) : (
              <UserCircle size={26} weight="bold" color={c.textOnBrand} />
            )}
          </View>
          <View style={styles.flex}>
            <Text weight="bold" numberOfLines={1} accessibilityRole="header">
              {coach?.display_name ?? t(isAi ? 'chat.aiName' : 'chat.humanName')}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {session ? t(`chat.about.${phase}` as TranslationKey, { workout: t(`workout.${session.type}` as TranslationKey) }) : (coachTitle ?? t('chat.subtitle'))}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workoutDetail.close')}
            onPress={() => router.back()}
            hitSlop={space[2]}
            style={({ pressed }) => [styles.close, { backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 }]}>
            <X size={18} weight="bold" color={c.text} />
          </Pressable>
        </View>
        {aiEnabled && humanEnabled ? (
          <View accessibilityRole="radiogroup" accessibilityLabel={t('chat.chooseCoach')} style={styles.switch}>
            <Chip fill label={t('chat.aiName')} selected={isAi} onPress={() => switchCoach('ai')} />
            <Chip fill label={t('chat.humanName')} selected={!isAi} onPress={() => switchCoach('human')} />
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.textBrand} />
        </View>
      ) : (
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            threadId ? (
              <View style={styles.empty}>
                <Text variant="heading">{t(isAi ? 'chat.emptyAiTitle' : 'chat.emptyHumanTitle')}</Text>
                {/* Pan Aloha mówi o sobie w pierwszej osobie (tekst ze słownika); trener-człowiek ma własny opis z panelu. */}
                <Text variant="caption">{isAi ? t('chat.emptyAiBody') : (coachHeadline ?? t('chat.emptyHumanBody'))}</Text>
                <View style={styles.suggestions}>
                  {suggestions.map((s) => (
                    <Chip key={s} label={s} selected={false} onPress={() => send(s)} />
                  ))}
                </View>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            sending && isAi ? (
              <Text variant="caption" style={styles.typing}>
                {t('chat.typing')}
              </Text>
            ) : !isAi && messages.at(-1)?.sender === 'user' ? (
              <Text variant="caption" style={styles.typing}>
                {t('chat.humanWait')}
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => {
            const mine = item.sender === 'user';
            return (
              <View style={[styles.row, mine ? styles.mine : styles.theirs]}>
                <View style={[styles.bubble, { backgroundColor: mine ? c.surfaceBrand : c.surface, borderColor: mine ? c.surfaceBrand : c.border }]}>
                  <Text color={mine ? 'textOnBrand' : 'text'}>{item.body}</Text>
                </View>
                {item.proposal && item.proposal_status ? (
                  <View style={[styles.proposal, { backgroundColor: c.surfaceBrandSoft }]}>
                    <Text variant="label" color="textBrand">
                      {t('chat.proposal.title')}
                    </Text>
                    <Text weight="semibold">{item.proposal.summary || t('chat.proposal.fallback')}</Text>
                    {item.proposal_status === 'pending' ? (
                      <View style={styles.actions}>
                        <Button label={t('chat.proposal.accept')} loading={answering === item.id} disabled={answering !== null} onPress={() => answer(item, true)} />
                        <Button variant="secondary" label={t('chat.proposal.decline')} disabled={answering !== null} onPress={() => answer(item, false)} />
                      </View>
                    ) : (
                      <Text variant="caption" color="text">
                        {t(`chat.proposal.${item.proposal_status}` as TranslationKey)}
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {needsConsent ? (
        <View style={[styles.consent, { backgroundColor: c.surfaceAccentSoft }]} accessibilityRole="alert">
          <Text weight="bold">{t('chat.health.title')}</Text>
          <Text variant="caption" color="text">
            {t('chat.health.body')}
          </Text>
          <View style={styles.actions}>
            <Button label={t('chat.health.agree')} loading={consenting || sending} disabled={consenting || sending} onPress={agreeAndSend} />
            <Button variant="plain" label={t('chat.health.decline')} disabled={consenting || sending} onPress={() => setError(null)} />
          </View>
        </View>
      ) : null}

      {errorText ? (
        <Text variant="caption" color="textAccentStrong" style={styles.error} accessibilityRole="alert">
          {errorText}
        </Text>
      ) : null}

      <View style={[styles.composer, { borderTopColor: c.border, paddingBottom: keyboard > 0 ? space[3] : Math.max(insets.bottom, space[3]) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={t('chat.placeholder')}
          multiline
          maxLength={2000}
          editable={threadId !== null}
          style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text, fontFamily: fontFamily.regular }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          accessibilityState={{ disabled: sending || draft.trim().length === 0 }}
          disabled={sending || draft.trim().length === 0 || !threadId}
          onPress={() => send(draft)}
          style={({ pressed }) => [styles.send, { backgroundColor: c.action, opacity: sending || draft.trim().length === 0 ? 0.4 : pressed ? 0.7 : 1 }]}>
          <PaperPlaneRight size={20} weight="bold" color={c.textOnBrand} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[3], gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: radius.pill },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  avatar: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: 44, height: 44 },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  switch: { flexDirection: 'row', gap: space[2] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3] },
  empty: { flexGrow: 1, justifyContent: 'flex-end', gap: space[2] },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingTop: space[2] },
  row: { gap: space[2], maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: space[4], paddingVertical: space[3], borderRadius: radius.card, borderWidth: 1.5 },
  proposal: { alignSelf: 'stretch', gap: space[2], padding: space[4], borderRadius: radius.card },
  actions: { gap: space[2], paddingTop: space[1] },
  typing: { paddingTop: space[1] },
  consent: { gap: space[2], marginHorizontal: space[5], marginBottom: space[2], padding: space[4], borderRadius: radius.card },
  error: { paddingHorizontal: space[5], paddingBottom: space[2] },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2], paddingHorizontal: space[5], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 132, paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[3], borderRadius: radius.card, borderWidth: 1.5, fontSize: font.size.md },
  send: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
