import { Contact, OperatorAddress } from "@/components/legal/contact";
import type { LegalDocument } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";

export const termsPl: LegalDocument = {
  title: "Regulamin",
  lead: (
    <p>
      Regulamin określa zasady korzystania z aplikacji mobilnej Aloha App i tej strony. Zakładając konto,
      zawierasz z nami umowę na warunkach opisanych poniżej. Przeczytaj zwłaszcza punkt 5 o zdrowiu i
      bezpieczeństwie.
    </p>
  ),
  sections: [
    {
      id: "uslugodawca",
      title: "Kim jesteśmy",
      body: (
        <>
          <p>Aplikację Aloha App udostępnia i usługi świadczy:</p>
          <OperatorAddress lang="pl" />
          <p>
            Spółka jest wpisana do rejestru przedsiębiorców Krajowego Rejestru Sądowego. W regulaminie
            nazywamy ją „my”, a osobę korzystającą z aplikacji – „Ty”. Skontaktujesz się z nami{" "}
            <Contact lang="pl" />.
          </p>
        </>
      ),
    },
    {
      id: "uslugi",
      title: "Co oferuje Aloha App",
      body: (
        <>
          <p>Aloha App to aplikacja dla biegaczy amatorów. W jej ramach świadczymy drogą elektroniczną usługi:</p>
          <ul>
            <li>konto użytkownika,</li>
            <li>plan biegowy ułożony na podstawie ankiety i dopasowywany tydzień po tygodniu,</li>
            <li>codzienny check-in i propozycje lżejszego treningu,</li>
            <li>prognozę pogody i podpowiedź najlepszej pory na bieg,</li>
            <li>pobieranie biegów ze Stravy i ocenę treningu względem planu,</li>
            <li>notatki i rozmowę z trenerem AI,</li>
            <li>rozmowę z trenerem-człowiekiem – w wybranych pakietach.</li>
          </ul>
          <p>
            Zakres funkcji może zależeć od pakietu, wersji aplikacji i systemu. Aplikację rozwijamy, więc
            funkcje mogą się zmieniać; o zmianach, które istotnie ograniczają to, z czego korzystasz,
            uprzedzimy zgodnie z punktem 14.
          </p>
        </>
      ),
    },
    {
      id: "wymagania",
      title: "Wymagania techniczne",
      body: (
        <ul>
          <li>telefon z systemem iOS lub Android w wersji wskazanej na karcie aplikacji w sklepie,</li>
          <li>dostęp do internetu,</li>
          <li>aktywny adres e-mail albo konto Apple lub Google,</li>
          <li>do funkcji opcjonalnych: konto Strava, zgoda systemowa na lokalizację.</li>
        </ul>
      ),
    },
    {
      id: "konto",
      title: "Konto i zawarcie umowy",
      body: (
        <>
          <ul>
            <li>Z aplikacji mogą korzystać osoby, które ukończyły 18 lat.</li>
            <li>
              Konto zakładasz, podając adres e-mail i hasło albo logując się kontem Apple lub Google, oraz
              akceptując ten regulamin i <a href={legalPath.privacy.pl}>Politykę prywatności</a>.
            </li>
            <li>Umowa o korzystanie z aplikacji zostaje zawarta z chwilą założenia konta, na czas nieoznaczony.</li>
            <li>Podaj prawdziwe dane, chroń hasło i nie udostępniaj konta innym osobom. Jedna osoba – jedno konto.</li>
          </ul>
        </>
      ),
    },
    {
      id: "zdrowie",
      title: "Zdrowie i bezpieczeństwo",
      body: (
        <>
          <div className="callout">
            <p>
              <strong>
                Aloha App nie jest wyrobem medycznym i nie zastępuje lekarza ani fizjoterapeuty. Plan,
                propozycje zmian i odpowiedzi trenera – także trenera AI – to wskazówki treningowe, a nie
                porady medyczne ani diagnoza.
              </strong>
            </p>
          </div>
          <ul>
            <li>
              Zanim zaczniesz trenować, upewnij się, że stan zdrowia Ci na to pozwala. Jeśli masz choroby
              przewlekłe, kontuzję, jesteś w ciąży, wracasz po długiej przerwie albo masz wątpliwości –
              skonsultuj się wcześniej z lekarzem.
            </li>
            <li>
              Przerwij trening i zgłoś się po pomoc medyczną, gdy pojawi się ból w klatce piersiowej,
              duszność, zawroty głowy, omdlenie albo ostry ból. W nagłej sytuacji dzwoń pod 112.
            </li>
            <li>
              Plan powstaje na podstawie tego, co nam podasz. Odpowiadaj w ankiecie i check-inie zgodnie z
              prawdą – od tego zależy, czy obciążenia będą dla Ciebie rozsądne.
            </li>
            <li>
              To Ty decydujesz, czy i jak wykonać trening. Dostosuj go do samopoczucia, pogody i warunków na
              trasie, a biegając, przestrzegaj przepisów ruchu drogowego.
            </li>
            <li>
              Prognoza pogody i podpowiedź pory biegu mają charakter orientacyjny i mogą różnić się od
              rzeczywistych warunków.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "trener",
      title: "Trener AI i trener-człowiek",
      body: (
        <>
          <ul>
            <li>
              Trener AI to program oparty na modelach językowych. Jego odpowiedzi powstają automatycznie i
              mogą zawierać błędy. Traktuj je jak podpowiedź, nie polecenie.
            </li>
            <li>
              Zmiany w planie są propozycjami: wchodzą w życie dopiero, gdy je zaakceptujesz, i zawsze możesz
              zostawić plan bez zmian.
            </li>
            <li>
              Liczba wiadomości do trenera AI jest ograniczona (obecnie 40 na dobę), żeby usługa działała
              sprawnie dla wszystkich.
            </li>
            <li>
              Trener-człowiek odpowiada w rozsądnym czasie, nie natychmiast. Nie jest to usługa medyczna ani
              pomoc w nagłych wypadkach.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "integracje",
      title: "Strava i inne usługi zewnętrzne",
      body: (
        <>
          <p>
            Część funkcji korzysta z usług innych firm: Stravy, dostawcy prognozy pogody (Open-Meteo),
            logowania Apple i Google. Korzystając z nich, podlegasz także regulaminom tych firm. Nie
            odpowiadamy za ich przerwy w działaniu ani za zmiany, które ograniczą dostęp do danych – w takiej
            sytuacji dana funkcja może działać gorzej albo zostać wyłączona.
          </p>
          <p>
            Strava jest znakiem towarowym Strava, Inc. Aloha App nie jest produktem Stravy ani nie jest przez
            nią sponsorowana.
          </p>
        </>
      ),
    },
    {
      id: "oplaty",
      title: "Opłaty",
      body: (
        <>
          <p>
            Założenie konta i korzystanie z aplikacji jest obecnie bezpłatne. Koszt połączenia z internetem
            ponosisz według taryfy swojego operatora.
          </p>
          <p>
            W przyszłości możemy wprowadzić płatne pakiety. Zanim cokolwiek zapłacisz, pokażemy cenę, zakres
            i zasady odnawiania, a zakup będzie wymagał Twojego wyraźnego potwierdzenia. Nie obciążymy Cię
            żadną opłatą bez niego.
          </p>
        </>
      ),
    },
    {
      id: "zasady",
      title: "Zasady korzystania",
      body: (
        <>
          <p>Korzystaj z aplikacji zgodnie z prawem i jej przeznaczeniem. W szczególności nie wolno:</p>
          <ul>
            <li>
              przesyłać treści bezprawnych, obraźliwych, naruszających prawa innych osób ani cudzych danych
              osobowych – dotyczy to także rozmów z trenerem,
            </li>
            <li>próbować uzyskać dostępu do danych innych osób ani obchodzić zabezpieczeń i limitów,</li>
            <li>kopiować, dekompilować ani odtwarzać kodu aplikacji poza zakresem dozwolonym przez prawo,</li>
            <li>pobierać danych automatycznie ani używać aplikacji do budowy konkurencyjnej usługi,</li>
            <li>odsprzedawać dostępu do aplikacji ani korzystać z niej komercyjnie bez naszej zgody.</li>
          </ul>
          <p>
            Jeśli poważnie lub uporczywie naruszasz te zasady, możemy po wcześniejszym wezwaniu do
            zaprzestania ograniczyć dostęp do funkcji albo wypowiedzieć umowę (punkt 13). Bezprawne treści
            możesz zgłosić nam na adres kontaktowy; zgłoszenia rozpatrujemy bez zbędnej zwłoki.
          </p>
        </>
      ),
    },
    {
      id: "prawa-autorskie",
      title: "Prawa do aplikacji i Twoich treści",
      body: (
        <>
          <p>
            Aplikacja, jej kod, wygląd, teksty i znaki należą do nas lub naszych licencjodawców. Na czas
            trwania umowy udzielamy Ci niewyłącznej, niezbywalnej licencji na korzystanie z aplikacji na
            własny, niekomercyjny użytek.
          </p>
          <p>
            Treści, które wprowadzasz (odpowiedzi, wiadomości, wyniki), pozostają Twoje. Pozwalasz nam
            przetwarzać je w zakresie potrzebnym do działania aplikacji. Plan treningowy ułożony dla Ciebie
            możesz swobodnie wykorzystywać na własne potrzeby.
          </p>
        </>
      ),
    },
    {
      id: "odpowiedzialnosc",
      title: "Dostępność i odpowiedzialność",
      body: (
        <>
          <ul>
            <li>
              Dokładamy starań, żeby aplikacja działała bez przerw, ale nie gwarantujemy ciągłej dostępności.
              Mogą zdarzyć się przerwy techniczne, awarie i prace serwisowe.
            </li>
            <li>
              Nie obiecujemy konkretnego wyniku sportowego. Prognoza czasu na zawodach to szacunek, nie
              gwarancja.
            </li>
            <li>
              Nie odpowiadamy za skutki podania nieprawdziwych informacji o sobie ani za skutki korzystania z
              aplikacji wbrew regulaminowi i zaleceniom z punktu 5.
            </li>
            <li>
              Wobec osób, które nie są konsumentami, nasza odpowiedzialność jest ograniczona do szkód
              wyrządzonych umyślnie.
            </li>
          </ul>
          <p>
            Żadne postanowienie regulaminu nie wyłącza ani nie ogranicza praw konsumenta wynikających z
            bezwzględnie obowiązujących przepisów, w tym odpowiedzialności za szkody na osobie i za szkody
            wyrządzone umyślnie.
          </p>
        </>
      ),
    },
    {
      id: "reklamacje",
      title: "Reklamacje",
      body: (
        <>
          <p>
            Jeśli aplikacja nie działa tak, jak powinna, napisz do nas <Contact lang="pl" />. Podaj adres
            e-mail konta, opis problemu i to, czego oczekujesz. Odpowiemy w ciągu 14 dni.
          </p>
          <p>
            Jako konsument masz uprawnienia z tytułu niezgodności usługi cyfrowej z umową, określone w
            ustawie o prawach konsumenta. Możesz też skorzystać z pozasądowych sposobów rozwiązywania sporów,
            na przykład z pomocy miejskiego lub powiatowego rzecznika konsumentów albo wojewódzkiego
            inspektoratu Inspekcji Handlowej. Nie jesteśmy zobowiązani do udziału w takich postępowaniach, a
            o zgodzie na nie zdecydujemy po otrzymaniu wniosku.
          </p>
        </>
      ),
    },
    {
      id: "rozwiazanie",
      title: "Odstąpienie i rozwiązanie umowy",
      body: (
        <>
          <ul>
            <li>
              <strong>Rezygnacja w każdej chwili.</strong> Możesz bez podania przyczyny i bez kosztów
              rozwiązać umowę, prosząc o usunięcie konta. Sposób opisuje{" "}
              <a href={`${legalPath.privacy.pl}#usuniecie`}>Polityka prywatności</a>.
            </li>
            <li>
              <strong>Odstąpienie.</strong> Jako konsument możesz też odstąpić od umowy w ciągu 14 dni od
              założenia konta, bez podania przyczyny. Wystarczy wiadomość z jednoznacznym oświadczeniem,
              wysłana przed upływem terminu.
            </li>
            <li>
              <strong>Wypowiedzenie przez nas.</strong> Możemy wypowiedzieć umowę z 30-dniowym wyprzedzeniem,
              gdy kończymy świadczenie usługi, albo z 7-dniowym, gdy mimo wezwania naruszasz regulamin.
              Poinformujemy Cię e-mailem. W tym czasie możesz poprosić o kopię swoich danych.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "zmiany",
      title: "Zmiany regulaminu",
      body: (
        <>
          <p>Regulamin możemy zmienić z ważnych powodów:</p>
          <ul>
            <li>zmiana przepisów albo decyzja organu, która wpływa na usługę,</li>
            <li>nowe funkcje, zmiana lub wycofanie istniejących, w tym wprowadzenie płatnych pakietów,</li>
            <li>względy bezpieczeństwa albo zmiany po stronie dostawców, z których korzystamy,</li>
            <li>zmiana naszych danych.</li>
          </ul>
          <p>
            O zmianie poinformujemy w aplikacji lub e-mailem co najmniej 14 dni przed jej wejściem w życie.
            Jeśli się z nią nie zgadzasz, możesz do tego dnia rozwiązać umowę, usuwając konto. Zmiana nie
            narusza praw nabytych wcześniej.
          </p>
        </>
      ),
    },
    {
      id: "prawo",
      title: "Prawo właściwe i spory",
      body: (
        <>
          <p>
            Umowa podlega prawu polskiemu. Jeśli jesteś konsumentem i mieszkasz w innym państwie Unii
            Europejskiej, zachowujesz ochronę, którą dają Ci bezwzględnie obowiązujące przepisy Twojego
            kraju.
          </p>
          <p>
            Spory z konsumentami rozstrzyga sąd właściwy według przepisów ogólnych. Spory z pozostałymi
            osobami rozstrzyga sąd właściwy dla naszej siedziby.
          </p>
          <p>
            Zasady przetwarzania danych osobowych opisuje{" "}
            <a href={legalPath.privacy.pl}>Polityka prywatności</a>.
          </p>
        </>
      ),
    },
  ],
};
