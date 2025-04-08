import {
    GoogleGenerativeAI,
    ChatSession,
    SchemaType,
    FunctionDeclaration, 
    Tool,
} from "@google/generative-ai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// --- Static Context Definition ---
// Note: Ideally there would be another function call to get this data because both the user profile and current location are dynamic values
// so the model should always have access to the most recent ones but for simplicity this remains as static content.
const STATIC_CONTEXT = {
    currentLocation: "Near Museum of Pop Culture (MoPOP), Seattle",
    userProfile: "Uses a manual wheelchair. Difficult navigating stairs or steep inclines (>5% gradient). Prefers smooth pavement and routes with curb cuts. Preferred mode for suitable routes is self-propelling (rolling); otherwise, considers alternative transport."
};

// --- Tool Implementation ---

/**
 * Placeholder function to simulate finding a route.
 * In a real app, this would call a routing service.
 */
async function find_route(
    { rephrasedUserQuery, reasoning }: { rephrasedUserQuery: string, reasoning: string }
): Promise<{ routeInfo: string }> {
    console.log(`\n--- TOOL CALL: find_route ---`);
    console.log(`Received refined query: "${rephrasedUserQuery}"`);
    console.log(`Reasoning: "${reasoning}"`);
    // Simulate API call / route calculation
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    console.log(`--- TOOL RESULT: Simulating route calculation... ---`);
    return { routeInfo: `Route calculation based on '${rephrasedUserQuery}' completed. No route found (placeholder).` };
}

// --- Tool Definition ---
const findRouteTool: FunctionDeclaration = {
    name: "find_route",
    description: `Calculates and finds a suitable route based on a detailed query.
                  Call this function whenever the user explicitly asks for directions, a route,
                  or how to get somewhere. The query should be reformulated first based on
                  conversation history and user profile context (if available/relevant)
                  to be clear and specific before calling this function.`,
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            rephrasedUserQuery: {
                type: SchemaType.STRING,
                description: `A detailed and unambiguous query specifying the origin, destination,
                              and any known user constraints (like accessibility needs inferred
                              from the user profile or conversation), reformulated from the
                              user's original request and the conversation history.`
            },
            reasoning: {
                type: SchemaType.STRING,
                description: `An explanation on why/how was the user query reformulated.`
            }
        },
        required: ["rephrasedUserQuery", "reasoning"]
    }
};

// --- System Instruction Definition ---
// Guides the model on its role, context awareness, and WHEN/HOW to use tools.
const SYSTEM_INSTRUCTION = `You are an AI assistant integrated into a navigation application.
Maintain awareness of the ongoing conversation history.
Your primary goal is to be helpful and provide accurate navigation-related information or perform tasks.

WHEN THE USER ASKS FOR A ROUTE OR DIRECTIONS:
1.  **CRUCIAL** Do not ask follow up questions or clarifications. Do your best to understand and answer the user request as fast as possible, fill up any information gaps using your best judgement.
1.  **Analyze Request:** Understand the user's request using the conversation as context.
1.  **Refine Query Internally:** Before calling any tool, mentally (or internally) refine the user's request into a clear, detailed query. Consider:
    * Correcting potential errors like typos (use the context like user profile and conversation history as reference).
    * Resolving ambiguous references ('there', 'it') using conversation history, e.g. "Tell more about Stanford" -> "What is the best way to get there?" -> can be rephrased as "What is the best way to get to Stanford?".
    * Augmenting with details like origin (if implied 'from here' or known location), destination (from history), and relevant user needs from the user profile'.
1.  **Call Tool:** Invoke the 'find_route' function, passing the fully refined, detailed query as the 'rephrasedUserQuery' argument.
1.  **Respond to User:** After the tool provides its result, formulate a natural language response to the user summarizing the route information or indicating if a route couldn't be found.

For general chat about places or accessibility, respond directly without calling the tool.


**User Profile**
Use the following information to better understand and assist the user:
${STATIC_CONTEXT.userProfile}

**Current Location**
The user is currently at this location: ${STATIC_CONTEXT.currentLocation}.

`


// --- Helper Functions ---

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


// --- Main Execution Logic ---

async function main() {
    let apiKey: string;
    try {
        apiKey = await getApiKey();
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }

    console.log("\nInitializing Model for Chat with Function Calling...");
    const genAI = new GoogleGenerativeAI(apiKey);

    const tools: Tool[] = [
      { functionDeclarations: [findRouteTool] }];

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools,
    });

    // --- Start the Chat Session ---
    const chat: ChatSession = model.startChat({
        history: []
    });

    console.log("Chat session started (with System Instruction & Tools).");
    console.log("Simulating conversation...");

    try {
        // --- Turn 1: User asks about the place ---
        const query1 = "Tell me more about the Pacific Science Center accessibility.";
        console.log(`\nUser: ${query1}`);
        let result = await chat.sendMessage(query1);
        let response = result.response;
        let responseText = response.text(); // Get initial text response
        console.log(`Assistant: ${responseText}`);

        // --- Turn 2: User asks for directions (raw query) ---
        const defaultQuery = "Whats the best Ruth to get there";
        const rlQuery = readline.createInterface({ input, output });
        let query2_raw = await rlQuery.question(`\nEnter your query (or press Enter for default: "${defaultQuery}"): `);
        rlQuery.close();
        if (!query2_raw || query2_raw.trim().length === 0) {
            query2_raw = defaultQuery;
        }    
        console.log(`\nUser: ${query2_raw}`);
        // Send the raw query. The model should decide to call the function.
        result = await chat.sendMessage(query2_raw);
        response = result.response;
        let completedFunctionCall = false
        // Keep chating with the LLM until it calls the tool
        while (!completedFunctionCall){
            // --- Function Calling Handling Loop ---
            // Check if the response contains a function call. Expected if the previous query
            // was identified as a route request.
            let functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
            if (functionCall) {
                completedFunctionCall = true;
                console.log(`\nAssistant requested Function Call: ${functionCall.name}`);
                const { name, args } = functionCall;
                if (name === "find_route") {
                    const apiResponse = await find_route(args as { rephrasedUserQuery: string, reasoning: string });
                    console.log(`Sending Function Response back to model...`);
                    result = await chat.sendMessage([
                        {
                            functionResponse: {
                                name: "find_route",
                                response: apiResponse,
                            }
                        }
                    ]);
                    response = result.response;
                    functionCall = response.candidates?.[0]?.content?.parts?.[0]?.functionCall;
                } else {
                    console.warn(`Received unexpected function call: ${name}`);
                    functionCall = undefined;
                }
            } else {
                response = result.response;
                responseText = response.text();
                console.log(`Assistant: ${responseText}`);
                console.log(`\nUser: Ok`);
                result = await chat.sendMessage(`Ok. Please help me find it.`);
            }
        }
        // --- Final Response ---
        // After handling any function calls, get the final text response
        responseText = response.text();
        console.log(`\nAssistant (Final Response ): ${responseText}`);


    } catch (error: any) {
        console.error("\n--- ERROR DURING CHAT OR PROCESSING ---");
        console.error("Error message:", error.message);
         // Log detailed response candidate if available for debugging
        if(error.response?.candidates) {
            console.error("Response Candidates:", JSON.stringify(error.response.candidates, null, 2));
        }
        console.error("---------------------------------------\n");
    }
} // End main

// Run the main function
main().catch(error => {
    console.error("Unhandled error during execution:", error);
    process.exit(1);
});