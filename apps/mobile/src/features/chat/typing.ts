// Rytm odpowiedzi trenera AI: model bywa szybszy niż człowiek zdążyłby przeczytać pytanie, a równy, zawsze taki sam
// czas wygląda mechanicznie. Dlatego kropki „pisze…” pojawiają się po chwili (jakby trener czytał wiadomość),
// a odpowiedź nie wcześniej niż po czasie zależnym od jej długości – za każdym razem trochę innym.
// To tylko dolna granica: gdy serwer odpowiada dłużej, niczego nie doliczamy.

const between = (min: number, max: number, random: () => number) => min + (max - min) * random();

/** Po ilu ms od wysłania pokazać „trener pisze…”. */
export function typingStartDelayMs(random: () => number = Math.random) {
  return Math.round(between(350, 1100, random));
}

/**
 * Najkrótszy czas od wysłania do pokazania odpowiedzi: stała „na namysł” + pisanie proporcjonalne do długości
 * (krótkie „Jasne!” szybciej niż trzy zdania), z losowym rozrzutem ±25% i sufitem, żeby nikt nie czekał bez sensu.
 */
export function replyMinDelayMs(replyLength: number, random: () => number = Math.random) {
  const thinking = between(900, 1800, random);
  const writing = Math.min(2600, Math.max(0, replyLength) * 9);
  return Math.round((thinking + writing) * between(0.75, 1.25, random));
}

/**
 * Stoper jednej odpowiedzi: startuje przy wysłaniu wiadomości, a `hold(długość)` czeka tyle, ile brakuje do
 * najkrótszego czasu dla odpowiedzi tej długości (nic, gdy serwer i tak odpowiadał dłużej).
 */
export function replyClock() {
  const sentAt = Date.now();
  return {
    hold: async (replyLength: number) => {
      const wait = replyMinDelayMs(replyLength) - (Date.now() - sentAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    },
  };
}
