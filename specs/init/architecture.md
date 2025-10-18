# Fullstack Architecture Document: FormFillAI

## 1. Wstęp i Wybór Szablonu Startowego

Projekt będzie bazował na oficjalnym szablonie startowym Vercela z Turborepo. Zapewnia to optymalną konfigurację dla monorepo, Next.js, TypeScript i wdrożeń na platformie Vercel, co znacząco przyspieszy prace nad MVP.

## 2. Architektura Wysokiego Poziomu

**Podsumowanie Techniczne:**  
Projekt będzie zrealizowany jako aplikacja webowa w architekturze Jamstack. Frontend zostanie zbudowany w React/Next.js i hostowany w sieci Vercel Edge. Logika backendowa zostanie zaimplementowana jako funkcje bezserwerowe (Serverless Functions) w ramach Next.js API Routes. Do komunikacji z modelami AI wykorzystamy bibliotekę Vercel AI SDK. Jako bazę danych wykorzystamy Supabase (PostgreSQL).

**Platforma i Infrastruktura:**

- **Platforma Wdrożeniowa:** Vercel
- **Baza Danych i BaaS:** Supabase

**Struktura Repozytorium:**  
Będziemy korzystać ze struktury Monorepo z Turborepo, z głównymi katalogami `apps/web`, `packages/shared`, `packages/tsconfig` i `packages/eslint-config`.

**Diagram Architektury:**

```mermaid
graph TD
    subgraph "Użytkownik"
        A[Przeglądarka]
    end

    subgraph "Platforma Vercel"
        B[Frontend (Next.js/React)]
        C[Backend (Next.js API Routes)]
    end

    subgraph "Zewnętrzne Usługi"
        D[Dostawca LLM (Anthropic Claude)]
        E[Baza Danych (Supabase/PostgreSQL)]
    end

    A -- Interakcja z komponentem --> B
    B -- Zapytania (Vercel AI SDK) --> C
    C -- Wywołania API LLM --> D
    C -- Zapis/Odczyt danych sesji --> E
```

**Wzorce Architektoniczne:**

- Jamstack/Serverless: Dla skalowalności i niskich kosztów
- Monorepo: Dla łatwego zarządzania i współdzielenia kodu
- Backend for Frontend (BFF): API w Next.js będzie działać jako BFF

---

## 3. Stos Technologiczny (Tech Stack)

| Kategoria          | Technologia   | Wersja (przykładowa) | Cel                             | Racjonalizacja                                       |
| ------------------ | ------------- | -------------------- | ------------------------------- | ---------------------------------------------------- |
| Język              | TypeScript    | ~5.5                 | Bezpieczeństwo typów            | Standard w nowoczesnych projektach                   |
| Framework          | Next.js       | ~15.1                | Frontend i backend              | Idealna integracja z Vercel                          |
| Biblioteka UI      | shadcn/ui     | Najnowsza            | Budowa interfejsu               | Elastyczna, dostępna, dobrze współpracuje z Tailwind |
| Styling            | Tailwind CSS  | ~3.4                 | Stylowanie                      | Szybkość i spójność UI                               |
| Zarządzanie Stanem | Zustand       | ~4.5                 | Prosty, globalny stan           | Minimalistyczne i wydajne rozwiązanie                |
| Biblioteka AI      | Vercel AI SDK | ~3.1                 | Komunikacja z LLM, UI           | Dedykowane rozwiązanie do naszego stosu              |
| Baza Danych        | PostgreSQL    | 16                   | Przechowywanie danych           | Niezawodna, skalowalna baza SQL (przez Supabase)     |
| Backend Service    | Supabase      | ~1.178               | Baza danych, autentykacja, API  | Przyspiesza development (BaaS)                       |
| Narzędzie Monorepo | Turborepo     | ~2.0                 | Zarządzanie monorepo            | Zintegrowane z Vercel, szybkie budowanie             |
| Testowanie (Unit)  | Jest + RTL    | Najnowsze            | Testy jednostkowe i komponentów | Standard w ekosystemie React                         |
| Testowanie (E2E)   | Playwright    | ~1.46                | Testy end-to-end                | Nowoczesne i niezawodne narzędzie E2E                |

---

## 4. Modele Danych (Data Models)

```ts
// Plik: packages/shared/src/types.ts

interface FormField {
  id: string;
  text: string;
  type: "text" | "number" | "email" | "select";
  options?: string[];
  validation?: { required?: boolean };
  ai_prompt?: string;
}

export interface ConversationSchema {
  id: string;
  welcomeMessage: string;
  fields: FormField[];
  webhookUrl: string;
  saveOnTheGo?: boolean;
  completionMessage: string;
}

export interface ConversationSession {
  sessionId: string;
  schemaId: string;
  currentFieldId: string;
  status: "in_progress" | "completed" | "abandoned";
  collectedData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. Specyfikacja API (API Specification)

**Endpoint:** `POST /api/chat`

**Zapytanie (Request Body):**

```ts
export interface ChatRequest {
  sessionId?: string;
  schemaId?: string;
  reply?: {
    fieldId?: string; // Opcjonalne
    value: any;
  };
}
```

**Odpowiedź (Response Body):**

```ts
export interface ChatResponse {
  sessionId: string;
  botMessage: string;
  conversationStatus: "in_progress" | "completed";
  nextField: {
    fieldId: string;
    type: "text" | "number" | "email" | "select";
    options?: string[];
  } | null;
}
```

---

## 6. Komponenty Logiczne

- **Komponent Frontendowy (`<FormFillAI/>`)**: Zarządza UI i komunikacją z API
- **Warstwa API (`/api/chat`)**: "Brama" do logiki biznesowej, obsługuje zapytania HTTP
- **Silnik Konwersacji (Conversation Engine)**: "Mózg" aplikacji; orkiestruje przebieg rozmowy, używając Vercel AI SDK do komunikacji z LLM i bazy danych do zarządzania stanem

---

## 7. Zewnętrzne API

- **API Dostawcy LLM (Anthropic Claude):** Główne źródło inteligencji, integrowane przez Vercel AI SDK
- **API Bazy Danych (Supabase):** Do przechowywania i zarządzania sesjami konwersacji

---

## 8. Kluczowe Przepływy Pracy

- **Rozpoczęcie Konwersacji:**  
  Frontend wysyła `schemaId` → Backend tworzy sesję w DB → Backend zwraca `sessionId` i pierwsze pytanie

- **Obsługa Odpowiedzi:**  
  Frontend wysyła `sessionId` i `reply` → Backend pobiera kontekst (`collectedData`) z DB → Backend wysyła pełny kontekst do LLM → LLM decyduje, czy dopytać, czy przejść dalej → Backend aktualizuje DB i zwraca kolejne pytanie lub pytanie doprecyzowujące

---

## 9. Schemat Bazy Danych

```sql
CREATE TABLE public.sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id TEXT NOT NULL,
  current_field_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger do automatycznej aktualizacji `updated_at`
-- ... (jak zdefiniowano wcześniej)
```

---

## 10. Ujednolicona Struktura Projektu

```
formfill-ai-monorepo/
├── apps/
│   └── web/
├── packages/
│   ├── shared/
│   ├── tsconfig/
│   └── eslint-config/
├── specs/
│   ├── project-brief.md
│   ├── prd.md
│   └── architecture.md
├── .env.example
├── package.json
└── turborepo.json
```

---

## 11. Wytyczne Implementacyjne

- **Standardy Kodowania:** TypeScript, ESLint, Prettier, nazewnictwo PascalCase/camelCase
- **Strategia Testowania:** Testy jednostkowe i komponentów (Jest + RTL) z celem >80% pokrycia
- **Obsługa Błędów:** Standaryzowany obiekt błędu JSON w odpowiedziach API
- **Przepływ Pracy z Git:** `main` jako główna gałąź, praca na feature branches, wprowadzanie zmian przez Pull Requests, usuwanie gałęzi po zmergowaniu. Dokumentacja (`specs/`) aktualizowana w ramach PR
