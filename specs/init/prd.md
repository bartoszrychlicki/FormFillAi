# Product Requirements Document (PRD): FormFillAI

## 1. Cele i Kontekst (Goals and Context)

**Cele (według priorytetu):**
1.  **Pozycjonowanie Pirxey jako eksperta AI:** Zdobycie praktycznego doświadczenia i stworzenie materiału (case study) do promocji firmy.
2.  **Zwiększenie Konwersji:** Dostarczenie narzędzia, które podnosi współczynnik ukończenia formularzy u klientów (cel: +20% w 6 miesięcy).
3.  **Poprawa Jakości Danych:** Zapewnienie, że zbierane dane są bardziej kompletne i dokładne (cel: redukcja błędów o 30%).

**Kontekst:**
Dokument ten bazuje na szczegółowym `Project Brief`, który definiuje wizję, problem, użytkowników i strategię dla produktu FormFillAI.

**Change Log:**
| Data | Wersja | Opis | Autor |
| --- | --- | --- | --- |
| 02.10.2025 | 1.0 | Utworzenie dokumentu | John, PM |

## 2. Wymagania (Requirements)

### Wymagania Funkcjonalne (Functional Requirements)
* **FR1:** System musi umożliwiać zdefiniowanie struktury konwersacji (formularza) za pomocą pliku konfiguracyjnego w formacie JSON.
* **FR2:** Plik konfiguracyjny JSON musi wspierać definiowanie prostych typów pól: tekst (text), numer (number), email oraz wybór z listy (select).
* **FR3:** Plik konfiguracyjny JSON musi pozwalać na zdefiniowanie prostej walidacji dla każdego pola (np. `required: true`).
* **FR4:** Plik konfiguracyjny JSON musi pozwalać na dodanie opcjonalnego pola `ai_prompt` do każdego pytania, które będzie zawierało wskazówki dla agenta AI.
* **FR5:** System musi prezentować pytania użytkownikowi w interfejsie chatu i prowadzić konwersację zgodnie z kolejnością zdefiniowaną w pliku JSON.
* **FR6:** System musi przechowywać odpowiedzi udzielone przez użytkownika w ramach jednej, aktywnej sesji.
* **FR7:** Po pomyślnym zebraniu wszystkich danych, system musi wysłać kompletny zbiór danych na predefiniowany adres docelowy (webhook).

### Wymagania Niefunkcjonalne (Non-functional Requirements)
* **NFR1:** Czas odpowiedzi agenta AI nie powinien przekraczać średnio 2 sekund.
* **NFR2:** Komponent React musi być zoptymalizowany pod kątem Core Web Vitals.
* **NFR3:** Integracja komponentu powinna być możliwa w czasie poniżej 30 minut.
* **NFR4:** Dokumentacja musi zawierać kompletny, działający przykład.
* **NFR5:** Architektura musi być zaprojektowana z myślą o minimalizacji kosztów (cel: < 300 USD/mies.).
* **NFR6:** Komunikacja frontend-backend musi być szyfrowana (HTTPS).
* **NFR7:** System nie może trwale przechowywać danych po wysłaniu ich do webhooka.
* **NFR8:** W wersji MVP, system wymaga od dewelopera skonfigurowania własnego klucza API do LLM ("Bring-Your-Own-Key").

## 3. Cele Interfejsu Użytkownika (User Interface Design Goals)
* **Wizja UX:** Interfejs minimalistyczny, czysty, skupiony na konwersacji, przypominający nowoczesny komunikator.
* **Paradygmaty:** Prostota, prowadzenie za rękę, natychmiastowy feedback.
* **Dostępność:** Cel: Zgodność z WCAG 2.1 na poziomie AA.
* **Branding:** Neutralny wygląd z możliwością łatwej customizacji podstawowych stylów (kolory, fonty) przez dewelopera.
* **Platformy:** Web Responsive (desktop + mobile).

## 4. Lista Epików (Epic List)

**Epic 1: Fundament, Interfejs Czatu i Połączenie**
* **Cel:** Stworzenie szkieletu aplikacji w monorepo, zbudowanie interfejsu komponentu czatu z użyciem gotowych bibliotek UI, uruchomienie podstawowego serwera API i zapewnienie, że potrafią się one ze sobą komunikować.

**Epic 2: Silnik Konwersacji oparty na Schemacie**
* **Cel:** Zaimplementowanie logiki, która odczytuje schemat JSON, prowadzi konwersację zgodnie z nim, wykonuje prostą walidację i przechowuje odpowiedzi w sesji.

**Epic 3: Dostarczenie Danych i Dokumentacja**
* **Cel:** Zaimplementowanie mechanizmu wysyłania zebranych danych na webhook oraz stworzenie kompletnej dokumentacji "Getting Started".

## 5. Szczegóły Epików (Epic Details)

### Epic 1: Fundament, Interfejs Czatu i Połączenie

* **1.1: Konfiguracja Monorepo i Projektów:** Jako deweloper, Chcę mieć skonfigurowane puste monorepo z aplikacją Next.js i pakietem `shared`, aby mieć solidny fundament.
* **1.2: Wyświetlenie Podstawowego Interfejsu Czatu:** Jako deweloper, Chcę zintegrować bibliotekę UI do czatu i wyświetlić statyczny interfejs, aby wizualnie potwierdzić działanie.
* **1.3: Stworzenie Prostego Endpointu API "Echo":** Jako deweloper, Chcę stworzyć endpoint `/api/chat`, który odsyła otrzymaną wiadomość, aby mieć działający backend.
* **1.4: Połączenie Interfejsu Czatu z API "Echo":** Jako użytkownik, Chcę, aby moja wiadomość została wysłana do API, a odpowiedź wyświetlona w czacie, aby zobaczyć działającą pętlę komunikacji.

### Epic 2: Silnik Konwersacji oparty na Schemacie

* **2.1: Zdefiniowanie Struktury Schematu Konwersacji (JSON):** Jako deweloper, Chcę mieć zdefiniowaną strukturę schematu JSON (jako interfejs TypeScript), aby wiedzieć, jak tworzyć formularze.
* **2.2: Wczytanie Schematu i Rozpoczęcie Konwersacji:** Jako deweloper, Chcę, aby API wczytało schemat i odesłało pierwsze pytanie, aby dynamicznie rozpocząć konwersację.
* **2.3: Prowadzenie Konwersacji Krok po Kroku i Zapisywanie Stanu:** Jako użytkownik, Chcę, aby po mojej odpowiedzi agent zadał kolejne pytanie, abym mógł przejść przez cały proces.
* **2.4: Implementacja Prostej Walidacji Odpowiedzi:** Jako użytkownik, Chcę, aby agent poinformował mnie o błędzie i poprosił o poprawienie odpowiedzi, abym miał pewność poprawności danych.

### Epic 3: Dostarczenie Danych i Dokumentacja

* **3.1: Wysłanie Zebranych Danych na Webhook:** Jako deweloper, Chcę, aby po zakończeniu konwersacji, dane zostały wysłane na mój webhook, abym mógł je dalej przetwarzać.
* **3.2: Stworzenie Dokumentacji "Getting Started":** Jako deweloper, Chcę mieć dostęp do `README.md` z instrukcją krok po kroku, aby móc szybko zintegrować komponent.
* **3.3: Zapisywanie Danych w Trakcie Konwersacji:** Jako deweloper, Chcę mieć opcję, aby dane były wysyłane na webhook na bieżąco, aby zminimalizować ryzyko ich utraty.