# Project Brief: FormFillAI

## 1. Streszczenie (Executive Summary)

FormFillAI to inteligentny komponent konwersacyjny, który zastępuje tradycyjne formularze, umożliwiając intuicyjne i efektywne zbieranie danych od użytkowników poprzez czat. Produkt rozwiązuje problem niskiej konwersji i negatywnego doświadczenia użytkownika (UX) związanego z wypełnianiem długich i skomplikowanych formularzy online. Istniejące rozwiązania rynkowe obejmują proste narzędzia do ankiet (np. Typeform) oraz ogólne platformy AI (np. Google Dialogflow), które wymagają budowania logiki od podstaw. FormFillAI pozycjonuje się jako wyspecjalizowany komponent, wypełniający tę lukę. Głównymi odbiorcami są deweloperzy oraz firmy z sektorów takich jak finanse i HR. Kluczową wartością jest podniesienie jakości zbieranych danych i znaczne polepszenie UX poprzez proaktywną asystę AI i personalizację procesu.

## 2. Opis Problemu (Problem Statement)

**Problemy Użytkownika Końcowego:**
* **Zniechęcenie:** Widok długiego, wielostronicowego formularza demotywuje.
* **Niepewność:** Niejasno sformułowane pytania i brak kontekstu.
* **Irytacja:** Rygorystyczne walidacje bez jasnego wyjaśnienia.
* **Powtarzalność:** Konieczność wpisywania tych samych danych wielokrotnie.
* **Poczucie bycia ignorowanym:** Użytkownik nie czuje, że jego odpowiedzi mają znaczenie, co prowadzi do niskiej jakości danych w polach otwartych.

**Problemy Biznesowe:**
* **Niska Konwersja:** Porzucone wnioski i procesy oznaczają utracony przychód.
* **Niska Jakość Danych:** Błędy w danych generują koszty ich poprawy i weryfikacji.
* **Wysokie Koszty Obsługi:** Konieczność angażowania pracowników do pomocy klientom, którzy utknęli na formularzu.
* **Utrata Wartościowych Informacji:** Płytkie, bezużyteczne odpowiedzi w polach otwartych.

**Dlaczego teraz?**
* **Dojrzałość technologii AI:** Modele językowe (LLM) stały się na tyle zaawansowane i dostępne, że realizacja projektu jest realna.
* **Rosnące oczekiwania użytkowników:** Użytkownicy oczekują płynnych, konwersacyjnych interakcji.
* **Presja na cyfrową transformację:** Firmy przenoszą coraz bardziej złożone procesy do internetu i potrzebują do tego skutecznych narzędzi.

## 3. Proponowane Rozwiązanie (Proposed Solution)

**Rdzeń Rozwiązania:**
FormFillAI to komponent oparty na architekturze headless (backend Node.js, frontend React). Jego działanie opiera się na silniku schematów konwersacji (w formacie JSON/YAML), który definiuje dane do zebrania, reguły walidacji i dynamikę rozmowy.

**Kluczowe Wyróżniki:**
* **Proaktywna Asysta i Wzbogacanie Danych:** Agent aktywnie pomaga użytkownikowi (np. uzupełniając kod pocztowy).
* **Pogłębiony Dialog (Deep Dive):** Dla pól subiektywnych, system potrafi dopytywać, aby uzyskać dane o wyższej jakości.
* **Elastyczność dla Deweloperów:** Silnik schematów pozwala na tworzenie nieskończonej liczby scenariuszy bez modyfikacji kodu.
* **Pamięć Kontekstowa:** Agent pamięta wcześniejsze odpowiedzi, eliminując powtórzenia.

**Wizja Produktu:**
Docelowo FormFillAI ma stać się wiodącą, łatwo integrowalną i customizowalną biblioteką/komponentem dla deweloperów. Realizując swoje cele biznesowe – zwiększanie konwersji i jakości danych dla klientów – produkt ten zaprezentuje również światu zaawansowane możliwości firmy Pirxey w dziedzinie AI.

## 4. Użytkownicy Docelowi (Target Users)

**Użytkownik Podstawowy: Deweloper**
* **Profil:** Full-stack/Frontend deweloper (React, Next.js).
* **Potrzeby:** Szybka i łatwa integracja, dobra dokumentacja, elastyczność.
* **Cel:** Dostarczenie wysokiej jakości funkcji do zbierania danych, oszczędzając czas i wysiłek.

**Użytkownik Wtórny: Użytkownik Końcowy**
* **Profil:** Każdy, kto musi wypełnić formularz online.
* **Potrzeby:** Jasność, prostota, poczucie bycia wysłuchanym i wspieranym.
* **Cel:** Szybkie i bezbolesne załatwienie swojej sprawy (np. otrzymanie kredytu), gdzie formularz jest tylko środkiem do celu.

## 5. Cele i Mierniki Sukcesu (Goals & Success Metrics)

**Cele Biznesowe:**
1.  **Zwiększenie Konwersji:** Wzrost o 20% w ciągu 6 miesięcy od wdrożenia.
2.  **Poprawa Jakości Danych:** Redukcja błędów w danych o 30%.
3.  **Pozycjonowanie Firmy Pirxey:** Publikacja 2 studiów przypadku (case studies) w ciągu roku.

**Mierniki Sukcesu Użytkownika:**
* **Deweloper:** Integracja w <30 min, łatwość customizacji, niezawodność.
* **Użytkownik Końcowy:** Krótszy czas wypełniania, poczucie wsparcia, pozytywne zaskoczenie.

**Kluczowe Wskaźniki Efektywności (KPIs):**
* Współczynnik Ukończenia Formularza (Form Completion Rate).
* Współczynnik Porzuceń (Drop-off Rate).
* Wskaźnik Błędów Walidacji (Validation Error Rate).
* Średni Czas Ukończenia (Average Completion Time).
* Ocena Satysfakcji (CSAT).

## 6. Zakres MVP (Minimum Viable Product)

**Kluczowe Funkcje MVP:**
1.  **Silnik Schematów (v1):** Obsługa podstawowych typów pól i prostej walidacji w JSON.
2.  **Rdzeń Konwersacyjny (v1):** Liniowe prowadzenie rozmowy na podstawie schematu.
3.  **Podstawowa Pamięć Kontekstowa:** W ramach jednej sesji.
4.  **Komponent React:** Działający interfejs czatu.
5.  **Endpoint API (Next.js):** Zarządzanie sesją i logiką.
6.  **Dokumentacja "Getting Started".**

**Poza Zakresem MVP:**
* Zaawansowane Wzbogacanie Danych.
* Pogłębiony Dialog (Deep Dive).
* Logika Warunkowa w Schematach.
* Zaawansowana Customizacja Wyglądu.
* Panel Analityczny.
* Zapisywanie i Wznawianie Sesji.

**Kryteria Sukcesu MVP:**
* **Techniczny:** Min. 3 deweloperów pomyślnie zintegruje komponent.
* **Jakościowy:** Min. 80% z nich potwierdzi wartość koncepcji i jakość dokumentacji.
* **Funkcjonalny:** MVP obsłuży min. 100 sesji bez krytycznych błędów.

## 7. Wizja po MVP (Post-MVP Vision)

**Funkcje na Fazę 2:**
1.  Pogłębiony Dialog (Deep Dive).
2.  Zaawansowane Wzbogacanie Danych.
3.  Logika Warunkowa.
4.  Zapisywanie i Wznawianie Sesji.
5.  Panel Analityczny (v1).

**Wizja Długoterminowa:**
* Ewolucja w platformę No-Code/Low-Code.
* Stworzenie silnika analitycznego do analizy zebranych danych.
* Ekspansja na nowe rynki (narzędzia wewnętrzne, edukacja, sektor publiczny, telemedycyna).

## 8. Wstępne Założenia Techniczne (Technical Considerations)

* **Platforma:** Aplikacje webowe (RWD).
* **Frontend:** React, TypeScript, **Vercel AI SDK**.
* **Backend:** Node.js, Next.js API Routes.
* **Baza Danych:** PostgreSQL lub MongoDB.
* **Architektura:** Monorepo (np. Turborepo), Headless.

## 9. Ograniczenia i Założenia (Constraints & Assumptions)

**Ograniczenia:**
* **Budżet:** ok. 300 USD miesięcznie.
* **Czas:** 2-3 tygodnie do MVP.
* **Zasoby:** 1-2 deweloperów.

**Założenia:**
* Istnieje realne zapotrzebowanie rynkowe.
* API modeli AI będą stabilne i wydajne.
* Projekt posłuży jako materiał promocyjny dla firmy Pirxey.
* Proces rozwoju będzie maksymalnie wspierany przez agentów AI.

## 10. Ryzyka i Otwarte Pytania (Risks & Open Questions)

* **Ryzyka:** Koszt API AI, złożoność implementacji, obawy deweloperów przed adopcją "czarnej skrzynki".
* **Otwarte Pytania:** Jak zarządzać kosztami API? Jaki model AI wybrać dla MVP? Jak powinna wyglądać pierwsza wersja schematu konwersacji?
* **Otwarte Pytania (chat-widget spike):** Jaką powierzchnię API powinien udostępniać pakiet `chat-widget` (gotowy komponent UI vs. headless + referencyjny UI)? Czy pakiet ma dostarczać własne style (np. CSS Modules) czy powinien być neutralny i pozostawić stylowanie konsumentowi? W jaki sposób konsumenci powinni konfigurować źródło schematu i webhook (props vs. zewnętrzne funkcje)? Jak wygląda oczekiwany mechanizm przekazywania klucza LLM / integracji z `ai-sdk` po stronie konsumenta?

## 11. Następne Kroki (Next Steps)

Zgodnie z procesem 'Greenfield Full-Stack', następnym krokiem jest praca z Product Managerem (PM) w celu stworzenia szczegółowego Product Requirements Document (PRD).

## Spike: Chat Widget Package (2025-10-07)

* **Zakres:** Wydzielenie komponentu `ChatPanel` oraz zależnej logiki do nowego pakietu `packages/chat-widget`, zapewnienie headless API opartego na istniejącym `ConversationEngine`, referencyjnego UI oraz dokumentacji integracyjnej.
* **Stan:** Analiza w toku – zidentyfikowano zależności od `fetch("/api/chat")`, Tailwind/Turbo klas utility, parsera schematu z `@formfillai/shared`.
* **Otwarte Zadania Techniczne:** Zaprojektować interfejs propsów (schema, webhook, AI client), strategię bundlowania (ESM/CJS + deklaracje), eksport CSS/stylów, strukturę testów jednostkowych, przykład integracji (np. Vite).
* **Otwarte Pytania:** Zob. sekcja 10.
