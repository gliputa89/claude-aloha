import type { Locale } from "@/lib/content";
import { operator } from "@/lib/legal/operator";

/** Pełne dane spółki – blok adresowy na początku dokumentów. */
export function OperatorAddress({ lang }: { lang: Locale }) {
  return (
    <address>
      <strong>{operator.name}</strong>
      <br />
      {operator.street}
      <br />
      {operator.city}, {operator.country[lang]}
      <br />
      KRS {operator.krs} · NIP {operator.nip} · REGON {operator.regon}
      {operator.email && (
        <>
          <br />
          E-mail: <a href={`mailto:${operator.email}`}>{operator.email}</a>
        </>
      )}
    </address>
  );
}

/**
 * Dokańcza zdanie „Napisz do nas …” / “Write to us …”.
 * Adres e-mail z lib/legal/operator.ts; gdyby był pusty, zostaje sam adres pocztowy.
 */
export function Contact({ lang }: { lang: Locale }) {
  const postal = `${operator.name}, ${operator.street}, ${operator.city}`;
  if (!operator.email) return <>{lang === "pl" ? `listownie na adres: ${postal}` : `by post at: ${postal}`}</>;
  const mail = <a href={`mailto:${operator.email}`}>{operator.email}</a>;
  return lang === "pl" ? (
    <>
      na adres {mail} albo listownie: {postal}
    </>
  ) : (
    <>
      at {mail} or by post: {postal}
    </>
  );
}
