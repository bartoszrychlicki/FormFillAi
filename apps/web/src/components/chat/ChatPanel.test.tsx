/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChatPanel } from "./ChatPanel";

const makeResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  json: async () => payload,
});

const createDeferred = <T,>() => {
  let resolve: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: resolve!,
  };
};

describe("ChatPanel", () => {
  const originalFetch = global.fetch;
  const schemaUrl = "/schemas/loan-intake.json";
  const schemaDefinition = {
    id: "loan-intake",
    welcomeMessage: "Hi there! I'm here to guide you through the loan intake.",
    completionMessage: "Perfect, thanks! We'll follow up shortly with next steps.",
    webhookUrl: "https://example.com/webhooks/loan-intake",
    fields: [
      {
        id: "full-name",
        text: "What's your full legal name?",
        type: "text",
        validation: {
          required: true,
          min_words: 2,
          failure_message:
            "Please provide your full legal name, including both first and last name.",
        },
        ai_prompt:
          "Only accept answers that include at least a first and last name. If the reply is too short or a single word, ask for the complete legal name before moving on.",
      },
      {
        id: "contact-email",
        text: "Which email address should we use for updates?",
        type: "email",
        validation: {
          required: true,
          failure_message:
            "That doesn't look like a valid email. Please reply with an address such as name@example.com.",
        },
        ai_prompt:
          "Confirm the response is a real email address containing '@' and a domain. If it is missing parts or formatted incorrectly, explain what is wrong and ask them to try again before you proceed.",
      },
      {
        id: "requested-amount",
        text: "How much funding are you looking for?",
        type: "number",
        validation: {
          required: true,
          failure_message:
            "Please share the amount using numbers (you can optionally use k/m/b for thousands, millions, or billions).",
        },
        ai_prompt:
          "Translate shorthand like 200k or 1.5m into a numeric USD amount. If the user mentions a different currency or gives a non-numeric description, confirm the USD amount before asking the next question.",
      },
      {
        id: "loan-purpose",
        text: "What will you use the funds for? Choose one of the options below.",
        type: "select",
        options: [
          "Home improvements",
          "Debt consolidation",
          "Vehicle purchase",
          "Education expenses",
          "Business investment",
          "Other",
        ],
        validation: {
          required: true,
          failure_message: "Please choose one of the listed purposes so we can continue.",
        },
        ai_prompt:
          "If the response does not match one of the provided options, ask the user to pick from the list. If they attempt to revise an earlier answer instead, clarify which question they want to update before moving forward.",
      },
    ],
    saveOnTheGo: false,
  } as const;

  const startTurn = {
    sessionId: "session-1",
    botMessage: "Hi there! Let's get started.\n\nWhat's your full legal name?",
    conversationStatus: "in_progress" as const,
    nextField: {
      fieldId: "full-name",
      text: "What's your full legal name?",
      type: "text" as const,
    },
  };

  const secondTurn = {
    sessionId: "session-1",
    botMessage: "Thanks Alicia! What's the best email?",
    conversationStatus: "in_progress" as const,
    nextField: {
      fieldId: "contact-email",
      text: "Which email address should we use for updates?",
      type: "email" as const,
    },
  };

  const thirdTurn = {
    sessionId: "session-1",
    botMessage: "Perfect, now pick the purpose below.",
    conversationStatus: "in_progress" as const,
    nextField: {
      fieldId: "loan-purpose",
      text: "What will you use the funds for? Choose one of the options below.",
      type: "select" as const,
      options: [
        "Home improvements",
        "Debt consolidation",
        "Vehicle purchase",
        "Education expenses",
        "Business investment",
        "Other",
      ],
    },
  };

  const finalTurn = {
    sessionId: "session-1",
    botMessage: "Great, that's everything we need!",
    conversationStatus: "completed" as const,
    nextField: null,
  };

  beforeEach(() => {
    let callCount = 0;

    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === "string" && input === schemaUrl && (!init || !init.method || init.method === "GET")) {
        return makeResponse(schemaDefinition);
      }

      const body = init?.body ? JSON.parse(init.body as string) : {};
      callCount += 1;

      if (callCount === 1) {
        expect(body).toEqual({ schema: schemaDefinition, schemaUrl });
        return makeResponse(startTurn);
      }

      expect(body.sessionId).toBe(startTurn.sessionId);

      if (callCount === 2) {
        expect(body.reply?.fieldId).toBe("full-name");
        expect(body.reply?.value).toBe("Alicia Example");
        return makeResponse(secondTurn);
      }

      if (callCount === 3) {
        expect(body.reply?.fieldId).toBe("contact-email");
        expect(body.reply?.value).toBe("alicia@example.com");
        return makeResponse(thirdTurn);
      }

      expect(body.reply?.fieldId).toBe("loan-purpose");
      expect(body.reply?.value).toBe("Business investment");
      return makeResponse(finalTurn);
    });

    global.fetch = fetchMock as typeof global.fetch;
  });

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  it("toggles the schema JSON preview", async () => {
    render(<ChatPanel schemaUrl={schemaUrl} />);

    const toggle = await screen.findByRole("button", { name: /show schema json/i });
    await waitFor(() => expect(toggle).toBeEnabled());

    await userEvent.click(toggle);

    const preview = screen.getByLabelText("Schema JSON preview");
    expect(preview).toBeInTheDocument();
    expect((preview as HTMLTextAreaElement).value).toContain('"id": "loan-intake"');

    await userEvent.click(screen.getByRole("button", { name: /hide schema json/i }));
    expect(screen.queryByLabelText("Schema JSON preview")).not.toBeInTheDocument();
  });

  it("shows a typing indicator while waiting for the next response", async () => {
    const secondTurnDeferred = createDeferred<ReturnType<typeof makeResponse>>();

    const fetchMock = jest.fn<Promise<ReturnType<typeof makeResponse>>, [RequestInfo | URL, RequestInit | undefined]>();
    let apiCallCount = 0;

    fetchMock.mockImplementation(async (input, init) => {
      if (typeof input === "string" && input === schemaUrl && (!init || !init.method || init.method === "GET")) {
        return makeResponse(schemaDefinition);
      }

      apiCallCount += 1;

      if (apiCallCount === 1) {
        return makeResponse(startTurn);
      }

      return secondTurnDeferred.promise;
    });

    global.fetch = fetchMock as typeof global.fetch;

    render(<ChatPanel schemaUrl={schemaUrl} />);

    expect(await screen.findByText(/let's get started/i)).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: /reply/i });

    await userEvent.type(input, "Alicia Example");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByTestId("typing-indicator")).toBeInTheDocument();

    secondTurnDeferred.resolve(makeResponse(secondTurn));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/what's the best email/i)).toBeInTheDocument();
    expect(screen.queryByTestId("typing-indicator")).not.toBeInTheDocument();
  });

  it("walks through a conversation start to finish", async () => {
    render(<ChatPanel schemaUrl={schemaUrl} />);

    expect(await screen.findByText(/let's get started/i)).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: /reply/i });
    await userEvent.type(input, "Alicia Example");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(/what's the best email/i)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, "alicia@example.com");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    const businessOption = await screen.findByRole("button", { name: "Business investment" });

    await userEvent.click(businessOption);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(5));
    expect(await screen.findByText(/that's everything we need/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: /reply/i })).toBeDisabled());
  });

  it("renders prompt suggestions for select fields", async () => {
    render(<ChatPanel schemaUrl={schemaUrl} />);

    expect(await screen.findByText(/let's get started/i)).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: /reply/i });
    await userEvent.type(input, "Alicia Example");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

    await userEvent.clear(input);
    await userEvent.type(input, "alicia@example.com");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));

    expect(await screen.findByRole("button", { name: "Home improvements" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Business investment" })).toBeEnabled();
  });

  it("allows shift+enter to insert a newline without submitting", async () => {
    render(<ChatPanel schemaUrl={schemaUrl} />);

    expect(await screen.findByText(/let's get started/i)).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: /reply/i });
    await userEvent.type(input, "Hello");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

    expect(input).toHaveValue("Hello\n");
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await userEvent.clear(input);
    await userEvent.type(input, "Alicia Example");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });
});
