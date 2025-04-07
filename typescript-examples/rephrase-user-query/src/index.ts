import { GoogleGenerativeAI, GenerativeModel, SchemaType } from "@google/generative-ai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';


interface RephrasedQueryResponse {
    rephrasedQuery: string;
    reason: string;
}

async function getApiKey(): Promise<string> {
    const rl = readline.createInterface({ input, output });
    console.log("\n---------------------------------------------------------------");
    console.log("This example requires a Google Gemini API Key.");
    console.log("Generate one at: https://aistudio.google.com/app/apikey");
    console.log("---------------------------------------------------------------");
    const apiKey = await rl.question('Paste your API Key here and press Enter: ');
    rl.close();
    if (!apiKey || apiKey.trim().length === 0) {
        console.error("\nAPI Key is required to proceed. Exiting.");
        process.exit(1);
    }
    return apiKey.trim();
}

const CONTEXT = {
    currentLocation: "Near Museum of Pop Culture (MoPOP), Seattle",
    conversationHistory: [
        { role: "user", text: "Tell me more about the Pacific Science Center. Is it good for kids?" },
        { role: "assistant", text: "Yes, the Pacific Science Center is very popular with families and has many hands-on exhibits suitable for children. It generally receives good reviews for accessibility, including ramps and elevators." }
    ],
    userProfile: "Uses a manual wheelchair. Difficult navigating stairs or steep inclines (>5% gradient). Prefers smooth pavement and routes with curb cuts. Preferred mode for suitable routes is self-propelling (rolling); otherwise, considers alternative transport."
};


/**
 * Uses the LLM to correct and augment a user query based on context.
 * @param model The GenerativeModel instance.
 * @param userQuery The original user query.
 * @param context The application context including profile and history.
 * @returns A promise resolving to the rephrased query and reason, or null on error.
 */
async function refineQueryWithContext(
    model: GenerativeModel,
    userQuery: string,
    context: typeof CONTEXT
): Promise<RephrasedQueryResponse | null> {

    const prompt = `
You are an AI assistant integrated into a navigation application. Your task is to refine user queries to be more precise and actionable for the routing engine, especially considering user context like accessibility needs.

Analyze the provided user query, considering the user's profile, conversation history, and potentially relevant location information.

**Instructions:**
1.  **Correct Errors:** Identify and correct potential spelling or grammatical errors that make the query unclear or nonsensical within a navigation context (e.g., correcting a word if it seems like a typo for a common navigation term like 'route' or 'directions', based on the surrounding words and conversation). Only make corrections if they significantly improve clarity or likely match user intent based on context.
2.  **Resolve Ambiguity:** Clarify ambiguous references (like "there", "it", "that place") using the conversation history or other contextual clues to determine the specific location or subject the user means.
3.  **Augment for Precision:** Enhance the query by adding relevant details derived from the provided context (user profile, conversation). The goal is to make the query specific enough for a detailed routing engine. Focus particularly on incorporating accessibility requirements mentioned in the user profile if applicable to the query. For example, adding terms like 'wheelchair accessible' or specifying needs like 'avoid stairs' if the profile indicates this and the query is about a route.
4.  **Formulate Query:** Based on the corrections and augmentations, formulate a clear, specific query suitable for querying a detailed map routing engine.
5.  **Explain Changes:** Provide the refined query and a brief explanation for the changes made (corrections, clarifications, added details from context) in the specified JSON format.

**Context:**

[User Profile]
${context.userProfile}

[Conversation History]
${context.conversationHistory.map(msg => `${msg.role}: ${msg.text}`).join('\n')}

[Potentially Relevant Location Info]
Current Location: ${context.currentLocation}
(Note: Use location info only if relevant to interpreting or augmenting the query, e.g., for directions 'from here'.)

**User Query to Refine:**
"${userQuery}"

**Output Format (JSON):**
{
  "rephrasedQuery": "The precise, augmented query for the routing engine.",
  "reason": "Brief explanation of corrections and augmentations made based on context and profile."
}
`;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        rephrasedQuery: {
                            type: SchemaType.STRING,
                            description: "The precise, augmented query suitable for a routing engine."
                        },
                        reason: {
                            type: SchemaType.STRING,
                            description: "Brief explanation of corrections (typos, ambiguity) and augmentations (context, profile needs) applied."
                        }
                    },
                    required: ['rephrasedQuery', 'reason'],
                },
            },
        });
        const response = result.response;

         if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
             console.warn("Received an empty or invalid response structure from the model.");
             return null;
         }

        const responseText = response.candidates[0].content.parts[0].text;

        if (!responseText) {
             console.warn("No response text received from the model candidate.");
             return null;
         }


        try {
            const parsedResponse = JSON.parse(responseText) as RephrasedQueryResponse;
            if (!parsedResponse || !parsedResponse.rephrasedQuery || !parsedResponse.reason) {
                console.warn("Parsed JSON response is missing required fields ('rephrasedQuery', 'reason').");
                console.log("Raw response text:", responseText);
                return null;
            }
            return parsedResponse;
        } catch (error) {
            console.error("Error parsing JSON response:", error);
            console.log("Raw response text:", responseText);
            return null;
        }
    } catch (error: any) {
        console.error("Error calling the Gemini API:", error);
        if (error.message) {
            console.error("Error message:", error.message);
        }
        return null;
    }
}

async function main() {
    const apiKey = await getApiKey();
    const defaultQuery = "okey, whats the best Ruth to get there";

    const rlQuery = readline.createInterface({ input, output });
    let userQuery = await rlQuery.question(`\nEnter your query (or press Enter for default: "${defaultQuery}"): `);
    rlQuery.close();

    if (!userQuery || userQuery.trim().length === 0) {
        userQuery = defaultQuery;
    }

    console.log("\nInitializing Model...");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    console.log("Refining query using context...");
    const rephrasedQueryResult = await refineQueryWithContext(model, userQuery, CONTEXT);

    if (rephrasedQueryResult) {
        console.log("\n--- Query Refinement Result ---");
        console.log("Original Query: ", userQuery);
        console.log("-----------------------------");
        console.log("Rephrased Query:", rephrasedQueryResult.rephrasedQuery);
        console.log("Reasoning:      ", rephrasedQueryResult.reason);
        console.log("---------------------------\n");
    } else {
        console.log("\nFailed to refine the query. Please check console logs for errors.\n");
    }
}

main().catch(console.error);