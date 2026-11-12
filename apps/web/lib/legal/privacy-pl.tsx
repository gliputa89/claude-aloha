import { Contact, OperatorAddress } from "@/components/legal/contact";
import type { LegalDocument } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";

export const privacyPl: LegalDocument = {
  title: "Polityka prywatności",
  lead: (
    <>
      <p>
        Aloha App układa plan biegowy i dopasowuje go do Twojego dnia. Żeby to robić, potrzebuje danych o Twoim
        bieganiu, a za Twoją zgodą także danych o zdrowiu: samopoczucia, zgłoszonego bólu i tętna z biegów.
      </p>
      <p>
        Ten dokument opisuje, jakie dane zbieramy w aplikacji mobilnej Aloha App i na tej stronie, po co to
        robimy, komu je przekazujemy i jak możesz nimi zarządzać. Nie sprzedajemy danych i nie wyświetlamy reklam.
      </p>
    </>
  ),
  sections: [
    {
      id: "administrator",
      title: "Kto odpowiada za Twoje dane",
      body: (
        <>
          <p>Administratorem danych osobowych jest właściciel aplikacji:</p>
          <OperatorAddress lang="pl" />
          <p>
            W sprawach dotyczących danych osobowych napisz do nas <Contact lang="pl" />. Nie wyznaczyliśmy
            inspektora ochrony danych.
          </p>
        </>
      ),
    },
    {
      id: "dane",
      title: "Jakie dane przetwarzamy",
      body: (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>Co dokładnie</th>
                  <th>Skąd</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Konto</td>
                  <td>
                    Adres e-mail, hasło w postaci skrótu (nie znamy Twojego hasła), imię lub nazwa, którą
                    podajesz, język, strefa czasowa. Przy logowaniu przez Apple lub Google: identyfikator
                    konta, adres e-mail i imię.
                  </td>
                  <td>Od Ciebie, od Apple lub Google</td>
                </tr>
                <tr>
                  <td>Ankieta biegowa</td>
                  <td>
                    Poziom, ostatni wynik (dystans i czas), tygodniowy kilometraż, liczba biegów w tygodniu,
                    cel (dystans, data i nazwa zawodów, docelowy czas), dni i czas, które masz na trening.
                  </td>
                  <td>Od Ciebie; część pól możemy podpowiedzieć na podstawie Stravy</td>
                </tr>
                <tr>
                  <td>Plan i treningi</td>
                  <td>
                    Zaplanowane treningi, ich status i Twoja ocena, wpisany dystans i czas, zmiany planu z
                    uzasadnieniem, ocena treningu względem planu, notatki trenera AI.
                  </td>
                  <td>Od Ciebie i z działania aplikacji</td>
                </tr>
                <tr>
                  <td>Dane o zdrowiu</td>
                  <td>
                    Odpowiedź na pytanie o kontuzje i przeciwwskazania (tak lub nie), samopoczucie z
                    check-inu (skala 1–5), znaczniki „mało snu” i „coś boli”, tętno z biegów (średnie,
                    maksymalne i przebieg w trakcie biegu), wiadomości do trenera, w których piszesz o
                    zdrowiu. Szczegóły w punkcie 3.
                  </td>
                  <td>Od Ciebie, ze Stravy</td>
                </tr>
                <tr>
                  <td>Rozmowy z trenerem</td>
                  <td>Treść wiadomości do trenera AI i do trenera-człowieka, propozycje zmian planu i Twoje decyzje.</td>
                  <td>Od Ciebie</td>
                </tr>
                <tr>
                  <td>Strava (opcjonalnie)</td>
                  <td>
                    Identyfikator i imię z nazwiskiem z konta Strava, tokeny dostępu, biegi i marsze: nazwa,
                    data, dystans, czas, przewyższenie, tempo na kolejnych odcinkach, a za zgodą na dane o
                    zdrowiu także tętno. Nie zapisujemy trasy GPS ani miejsca startu.
                  </td>
                  <td>Ze Stravy, po Twoim połączeniu konta</td>
                </tr>
                <tr>
                  <td>Przybliżona lokalizacja (opcjonalnie)</td>
                  <td>
                    Współrzędne zaokrąglone do 0,1° (około 10 km) i nazwa miejscowości, potrzebne do prognozy
                    pogody. Szczegóły w punkcie 7.
                  </td>
                  <td>Z telefonu, za zgodą systemową, albo z wpisanej nazwy miejsca</td>
                </tr>
                <tr>
                  <td>Zgody</td>
                  <td>Rejestr zgód: rodzaj, wersja dokumentu, data udzielenia lub wycofania.</td>
                  <td>Z działania aplikacji</td>
                </tr>
                <tr>
                  <td>Dane techniczne</td>
                  <td>
                    Adres IP i podstawowe informacje o urządzeniu w logach serwera, zapisy wywołań AI
                    (punkt 5).
                  </td>
                  <td>Z działania aplikacji i strony</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Nie zbieramy daty urodzenia, płci, wagi ani wzrostu. Aplikacja nie ma dostępu do kontaktów, zdjęć
            ani mikrofonu, nie śledzi trasy biegu i nie wysyła powiadomień push.
          </p>
        </>
      ),
    },
    {
      id: "zdrowie",
      title: "Dane o zdrowiu",
      body: (
        <>
          <div className="callout">
            <p>
              <strong>
                Samopoczucie, ból, sen, tętno i informacje o kontuzjach to dane dotyczące zdrowia, czyli
                szczególna kategoria danych (art. 9 RODO). Przetwarzamy je wyłącznie na podstawie Twojej
                wyraźnej zgody.
              </strong>
            </p>
          </div>
          <p>
            O zgodę pytamy osobno, w ankiecie startowej, przy pierwszej wiadomości o zdrowiu w rozmowie z
            trenerem albo przy włączaniu check-inu w Profilu. Pole zgody nigdy nie jest zaznaczone z góry, a
            zgoda nie jest warunkiem korzystania z aplikacji.
          </p>
          <p>Zgoda obejmuje:</p>
          <ul>
            <li>codzienny check-in: samopoczucie i znaczniki „mało snu”, „coś boli”,</li>
            <li>tętno z biegów pobieranych ze Stravy i wnioski z niego w ocenie treningu,</li>
            <li>wiadomości do trenera, w których piszesz o bólu, kontuzji, chorobie lub lekach,</li>
            <li>odpowiedź na pytanie o kontuzje i przeciwwskazania z ankiety startowej.</li>
          </ul>
          <p>
            Bez zgody aplikacja działa w trybie podstawowym: układa plan, ale nie pokazuje check-inu, nie
            pobiera tętna, a wiadomości o zdrowiu nie zapisuje i nie wysyła dalej.
          </p>
          <p>
            Zgodę wycofasz w każdej chwili w Profilu, wyłączając check-in. Od tego momentu nie zbieramy nowych
            danych o zdrowiu. Jeśli chcesz, żebyśmy usunęli także dane zebrane wcześniej, napisz do nas –
            zrobimy to w ciągu 30 dni. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania sprzed
            jej wycofania.
          </p>
          <p>
            Danych o zdrowiu używamy tylko do dopasowania planu i odpowiedzi trenera. Nie używamy ich do
            marketingu i nie przekazujemy ich ubezpieczycielom, pracodawcom ani reklamodawcom.
          </p>
        </>
      ),
    },
    {
      id: "cele",
      title: "Po co i na jakiej podstawie",
      body: (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cel</th>
                  <th>Dane</th>
                  <th>Podstawa prawna</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Założenie konta, ułożenie i prowadzenie planu, rozmowa z trenerem, pogoda, Strava</td>
                  <td>Konto, ankieta, plan, rozmowy, Strava, przybliżona lokalizacja</td>
                  <td>
                    Wykonanie umowy o korzystanie z aplikacji (art. 6 ust. 1 lit. b RODO), czyli{" "}
                    <a href={legalPath.terms.pl}>Regulaminu</a>
                  </td>
                </tr>
                <tr>
                  <td>Check-in, tętno, rozmowa o zdrowiu, ostrożniejszy plan przy przeciwwskazaniach</td>
                  <td>Dane o zdrowiu</td>
                  <td>Twoja wyraźna zgoda (art. 9 ust. 2 lit. a RODO)</td>
                </tr>
                <tr>
                  <td>Bezpieczeństwo usługi, wykrywanie błędów i nadużyć, kontrola kosztów AI</td>
                  <td>Dane techniczne, zapisy wywołań AI</td>
                  <td>Nasz prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO)</td>
                </tr>
                <tr>
                  <td>Zbiorcze statystyki korzystania z aplikacji, bez treści rozmów</td>
                  <td>Dane o planie i treningach w postaci zagregowanej</td>
                  <td>Nasz prawnie uzasadniony interes: rozwój aplikacji (art. 6 ust. 1 lit. f RODO)</td>
                </tr>
                <tr>
                  <td>Odpowiedzi na zgłoszenia, reklamacje, dochodzenie i obrona roszczeń</td>
                  <td>Konto, korespondencja, rejestr zgód</td>
                  <td>Art. 6 ust. 1 lit. b, c i f RODO</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Podanie danych jest dobrowolne, ale bez adresu e-mail i odpowiedzi z ankiety nie założymy konta
            ani nie ułożymy planu. Strava, lokalizacja i dane o zdrowiu są w pełni opcjonalne.
          </p>
          <p>
            Aplikacja automatycznie dobiera treningi do Twoich odpowiedzi i wyników, co jest formą
            profilowania. Zmiany w planie są propozycjami, które akceptujesz lub odrzucasz. Nie podejmujemy
            wobec Ciebie decyzji, które wywołują skutki prawne lub w podobny sposób istotnie na Ciebie
            wpływają.
          </p>
        </>
      ),
    },
    {
      id: "ai",
      title: "Sztuczna inteligencja",
      body: (
        <>
          <p>
            Część funkcji działa dzięki modelom Claude firmy Anthropic: układanie kolejnych tygodni planu,
            prognoza wyniku, ocena treningu, notatki trenera, porada pogodowa i rozmowa z trenerem AI.
            Codzienny check-in działa na prostych regułach, bez AI.
          </p>
          <p>Do modelu wysyłamy tylko to, czego potrzebuje dane zadanie:</p>
          <ul>
            <li>dane z ankiety i cel, w tym informację, czy zgłaszasz przeciwwskazania,</li>
            <li>plan, statusy i oceny treningów,</li>
            <li>
              faktyczny dystans, czas i tempo biegu oraz wnioski z jego przebiegu, także jeśli pochodzą ze
              Stravy; za zgodą na dane o zdrowiu również wnioski z tętna (na przykład jego narastanie w
              trakcie biegu), bez surowego zapisu tętna,
            </li>
            <li>ostatnie wiadomości z rozmowy z trenerem AI,</li>
            <li>samą pogodę i rodzaj treningu – bez lokalizacji.</li>
          </ul>
          <p>
            Do modelu nie trafia Twój adres e-mail, imię ani identyfikator konta, chyba że samodzielnie
            wpiszesz takie dane w wiadomości do trenera. Anthropic działa na nasze zlecenie jako podmiot
            przetwarzający i zgodnie ze swoimi warunkami dla klientów biznesowych nie trenuje modeli na
            danych przesyłanych przez API.
          </p>
          <p>
            Każde wywołanie AI zapisujemy u siebie na 30 dni razem z jego treścią, żeby wyjaśniać błędy i
            pilnować jakości odpowiedzi. Po tym czasie zostaje sam zapis techniczny (data, funkcja, koszt).
          </p>
          <p>
            Odpowiedzi AI mogą być nietrafne. Trener AI nie stawia diagnoz i nie zastępuje lekarza ani
            fizjoterapeuty.
          </p>
        </>
      ),
    },
    {
      id: "strava",
      title: "Strava",
      body: (
        <>
          <p>
            Konto Strava łączysz dobrowolnie, w Profilu. Prosimy o uprawnienie do odczytu aktywności, także
            prywatnych. Pobieramy wyłącznie biegi i marsze z ostatnich 30 dni, a przy pierwszej ankiecie
            jednorazowo przeglądamy historię z ostatnich 26 tygodni, żeby podpowiedzieć Twój poziom – tej
            historii nie zapisujemy.
          </p>
          <p>
            Niczego nie publikujemy na Twoim koncie Strava i niczego w nim nie zmieniamy. Aktywność usunięta
            w Stravie znika także u nas przy kolejnej synchronizacji.
          </p>
          <p>
            Po rozłączeniu konta w Profilu cofamy dostęp po stronie Stravy i usuwamy pobrane aktywności oraz
            tokeny. W planie zostają tylko dystans i czas przy treningach, które zostały już odhaczone.
          </p>
        </>
      ),
    },
    {
      id: "lokalizacja",
      title: "Lokalizacja i pogoda",
      body: (
        <>
          <p>
            Karta pogody potrzebuje wiedzieć, mniej więcej gdzie biegasz. Możesz zezwolić na lokalizację
            „podczas używania aplikacji” albo wpisać nazwę miejscowości. Bez tego aplikacja działa normalnie,
            tylko bez pogody.
          </p>
          <ul>
            <li>Prosimy system o lokalizację o obniżonej dokładności i nigdy nie odczytujemy jej w tle.</li>
            <li>
              Współrzędne zaokrąglamy na telefonie do 0,1° (około 10 km). Tylko taka wartość trafia na nasz
              serwer i do dostawcy prognozy, Open-Meteo.
            </li>
            <li>
              Nazwę miejscowości ustala wbudowana usługa Twojego telefonu (Apple albo Google), która w tym
              celu otrzymuje położenie lub wpisany tekst.
            </li>
            <li>Lokalizacja nie trafia do modeli AI.</li>
          </ul>
        </>
      ),
    },
    {
      id: "odbiorcy",
      title: "Komu przekazujemy dane",
      body: (
        <>
          <p>Korzystamy z dostawców, bez których aplikacja nie mogłaby działać:</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Odbiorca</th>
                  <th>Rola</th>
                  <th>Jakie dane</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Supabase</td>
                  <td>Baza danych, logowanie, serwer aplikacji; dane w regionie Frankfurt (UE)</td>
                  <td>Wszystkie dane konta i aplikacji</td>
                </tr>
                <tr>
                  <td>Anthropic</td>
                  <td>Modele AI Claude</td>
                  <td>Dane opisane w punkcie 5, bez e-maila i imienia</td>
                </tr>
                <tr>
                  <td>Strava</td>
                  <td>Źródło Twoich biegów, jeśli połączysz konto</td>
                  <td>Od nas: tylko zapytania o Twoje aktywności</td>
                </tr>
                <tr>
                  <td>Open-Meteo</td>
                  <td>Prognoza pogody i jakości powietrza</td>
                  <td>Zaokrąglone współrzędne, bez powiązania z kontem</td>
                </tr>
                <tr>
                  <td>Apple, Google</td>
                  <td>Logowanie kontem Apple lub Google, ustalanie nazwy miejscowości, sklepy z aplikacjami</td>
                  <td>Dane potrzebne do logowania; położenie lub nazwa miejsca</td>
                </tr>
                <tr>
                  <td>Expo</td>
                  <td>Dostarczanie aktualizacji aplikacji</td>
                  <td>Dane techniczne urządzenia, adres IP</td>
                </tr>
                <tr>
                  <td>Vercel</td>
                  <td>Hosting tej strony i panelu administracyjnego (region Frankfurt)</td>
                  <td>Adres IP i dane techniczne w logach</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Dostęp do danych mają też upoważnione osoby z naszego zespołu, w zakresie potrzebnym do obsługi
            aplikacji, wyjaśniania błędów i odpowiadania na zgłoszenia. Jeśli korzystasz z rozmowy z
            trenerem-człowiekiem, Twoje wiadomości i dane treningowe widzi przydzielony trener oraz osoby,
            które obsługują tę usługę po naszej stronie.
          </p>
          <p>
            Dane możemy udostępnić organom publicznym, gdy wymaga tego prawo. Nie sprzedajemy danych i nie
            udostępniamy ich reklamodawcom.
          </p>
        </>
      ),
    },
    {
      id: "transfer",
      title: "Przekazywanie danych poza Europejski Obszar Gospodarczy",
      body: (
        <>
          <p>
            Dane aplikacji przechowujemy w Unii Europejskiej. Część dostawców (Anthropic, Supabase, Vercel,
            Expo, Apple, Google, Strava) ma siedzibę w Stanach Zjednoczonych i może tam przetwarzać dane.
            Przekazanie odbywa się wtedy na podstawie decyzji Komisji Europejskiej o odpowiednim stopniu
            ochrony (Ramy ochrony danych UE–USA) albo standardowych klauzul umownych. Open-Meteo działa w
            Szwajcarii, wobec której Komisja Europejska stwierdziła odpowiedni stopień ochrony.
          </p>
          <p>Kopię stosowanych zabezpieczeń udostępnimy na Twoją prośbę.</p>
        </>
      ),
    },
    {
      id: "okres",
      title: "Jak długo przechowujemy dane",
      body: (
        <>
          <ul>
            <li>
              <strong>Dane konta, plan, treningi, rozmowy, dane o zdrowiu:</strong> do usunięcia konta.
            </li>
            <li>
              <strong>Aktywności ze Stravy:</strong> do rozłączenia Stravy, usunięcia aktywności w Stravie
              albo usunięcia konta.
            </li>
            <li>
              <strong>Treść wywołań AI w naszych logach:</strong> 30 dni.
            </li>
            <li>
              <strong>Przybliżona lokalizacja:</strong> razem z treningiem, którego dotyczy prognoza; jest
              nadpisywana przy każdym odświeżeniu pogody.
            </li>
            <li>
              <strong>Rejestr zgód:</strong> do usunięcia konta.
            </li>
            <li>
              <strong>Zapis o usunięciu konta</strong> (adres e-mail i data): do 6 lat, na wypadek roszczeń
              i żeby wykazać, że żądanie zostało spełnione.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "prawa",
      title: "Twoje prawa",
      body: (
        <>
          <p>Masz prawo do:</p>
          <ul>
            <li>dostępu do danych i otrzymania ich kopii,</li>
            <li>sprostowania danych – większość zmienisz samodzielnie w aplikacji,</li>
            <li>usunięcia danych,</li>
            <li>ograniczenia przetwarzania,</li>
            <li>przenoszenia danych (otrzymasz je w pliku w formacie nadającym się do odczytu maszynowego),</li>
            <li>sprzeciwu wobec przetwarzania opartego na naszym uzasadnionym interesie,</li>
            <li>wycofania zgody na dane o zdrowiu w dowolnym momencie.</li>
          </ul>
          <p>
            Żeby skorzystać z tych praw, napisz do nas <Contact lang="pl" />. Odpowiadamy bez zbędnej zwłoki,
            najpóźniej w ciągu miesiąca. Możemy poprosić o potwierdzenie, że piszesz z adresu przypisanego do
            konta.
          </p>
          <p>
            Możesz też wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193
            Warszawa, uodo.gov.pl).
          </p>
        </>
      ),
    },
    {
      id: "usuniecie",
      title: "Usunięcie konta",
      body: (
        <>
          <p>
            Żeby usunąć konto, napisz do nas <Contact lang="pl" /> z adresu e-mail przypisanego do konta.
            Konto i wszystkie powiązane dane – plan, treningi, check-iny, rozmowy, aktywności ze Stravy i
            zapisy wywołań AI – usuwamy w ciągu 30 dni. Zostaje wyłącznie zapis o usunięciu konta opisany w
            punkcie 10.
          </p>
          <p>
            Jeśli Twoje konto było połączone ze Stravą, dostęp aplikacji możesz dodatkowo cofnąć w
            ustawieniach Stravy.
          </p>
        </>
      ),
    },
    {
      id: "bezpieczenstwo",
      title: "Jak chronimy dane",
      body: (
        <>
          <ul>
            <li>Połączenia z aplikacją i stroną są szyfrowane (TLS), a baza danych jest szyfrowana w spoczynku.</li>
            <li>Reguły dostępu w bazie sprawiają, że każda osoba widzi w aplikacji wyłącznie swoje dane.</li>
            <li>Klucze do usług AI i tokeny Stravy są przechowywane tylko na serwerze, nigdy w aplikacji.</li>
            <li>Dostęp do panelu administracyjnego mają wyłącznie upoważnione osoby.</li>
          </ul>
        </>
      ),
    },
    {
      id: "wiek",
      title: "Wiek",
      body: (
        <p>
          Aplikacja jest przeznaczona dla osób pełnoletnich. Nie kierujemy jej do dzieci i świadomie nie
          zbieramy ich danych. Jeśli uważasz, że konto założyła osoba niepełnoletnia, napisz do nas – usuniemy
          je.
        </p>
      ),
    },
    {
      id: "strona",
      title: "Ta strona i pliki cookie",
      body: (
        <p>
          Strona nie używa plików cookie, narzędzi analitycznych ani skryptów śledzących. Serwer, na którym
          działa, zapisuje w logach adres IP i dane techniczne przeglądarki, co jest potrzebne do jej
          bezpiecznego działania. Aplikacja mobilna przechowuje na Twoim telefonie dane sesji logowania oraz
          ustawienia (wybraną miejscowość, motyw).
        </p>
      ),
    },
    {
      id: "zmiany",
      title: "Zmiany tej polityki",
      body: (
        <p>
          Politykę aktualizujemy, gdy zmienia się aplikacja albo prawo. O istotnych zmianach poinformujemy w
          aplikacji lub e-mailem przed ich wejściem w życie. Jeśli zmiana będzie wymagała nowej zgody,
          poprosimy o nią.
        </p>
      ),
    },
  ],
};
