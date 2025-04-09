import {
    GoogleGenerativeAI,
    GenerativeModel,
    ChatSession,
    SchemaType,
    Part,
    FunctionDeclaration,
    FunctionResponsePart,
    GenerateContentRequest
} from "@google/generative-ai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'fs/promises';
import path from 'path';


// --- Interfaces ---
interface TimestampResponse { timestamps: string[] };
interface AnswerResponse { answerText: string };

// --- Constants ---
const STORYBOARD_IMAGE_PATH = path.join(__dirname, '../resources', 'placeholder_storyboard.jpg');

const VIDEO_DESCRIPTIONS = `
0:00 Shoreline Amphitheatre exterior, crowd.
0:03 Google I/O 2024 logo & montage.
0:05 CEO Sundar Pichai takes selfie near seating.
0:07 Lamp post with Google I/O banners.
0:08 Person walks onto main stage.
0:09 Speaker on stage addressing audience.
0:11 DeLorean car with 'G3MIN1' plate.
0:13 Woman points at event map.
0:15 People queuing at 'Multimodal Search' tent.
0:17 Screen displays Google I/O hashtag.
0:18 Man interacts with animation screen.
0:19 Person stands before large grid screen.
0:20 People gather around large display.
0:21 Woman walks through outdoor seating area.
0:22 Amphitheatre stage, large abstract screen design.
0:23 Android logo appears on a leaf.
0:24 Sundar Pichai walks onto stage, Google colors backdrop.
0:25 Group takes selfie, laughing.
0:26 Woman dances near Android Bugdroid display.
0:28 Woman kicks soccer ball on mini-field.
0:30 Two women wave at camera while seated.
0:32 Large crowd cheers near stage.
0:34 People walk past Shoreline Amphitheatre.
0:36 On-screen text: 'Tune in May 20-21' with Google I/O logo.
`;

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


/**
 * Loads an image file and encodes it to Base64.
 */
async function loadImageBase64(filePath: string): Promise<Part> {
    try {
        const buffer = await fs.readFile(filePath);
        const base64Data = buffer.toString('base64');
        // Determine mime type (simple check)
        const mimeType = path.extname(filePath) === '.png' ? 'image/png' : 'image/jpeg';
        console.log(`Loaded image ${filePath}, size: ${Math.round(buffer.length / 1024)} KB, mime: ${mimeType}`);
        return {
            inlineData: {
                mimeType,
                data: base64Data,
            },
        };
    } catch (error) {
        console.error(`Error loading image file ${filePath}:`, error);
        throw new Error(`Failed to load storyboard image.`);
    }
}


// --- Tool Implementations ---

/**
 * Tool 1: Finds relevant timestamps using a transactional LLM call.
 * Needs access to a model instance.
 */
async function find_relevant_timestamps(
    { userQuery }: { userQuery: string },
    model: GenerativeModel 
): Promise<{ relevantTimestamps: string[] }> {
    console.log(`\n--- TOOL CALL: find_relevant_timestamps ---`);
    console.log(`Finding timestamps relevant to: "${userQuery}"`);

    // Prepare prompt for the transactional call
    const transactionalPrompt = `Analyze the following video descriptions and identify the timestamps (in MM:SS format) that are most relevant to answering the user query. Return ONLY a JSON array of strings containing the relevant timestamps. If no specific timestamps seem relevant, return an empty array.

Video Descriptions:
---
${VIDEO_DESCRIPTIONS}
---

User Query: "${userQuery}"

Response format: JSON with the relevant timestamps where each timestamp is related to the user query.`;

    const request: GenerateContentRequest = {
        contents: [{ role: "user", parts: [{ text: transactionalPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    timestamps: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING }
                    }
                },
                required: ["timestamps"]
            }
        }
    };

    try {
        const result = await model.generateContent(request);
        const response = result.response;
        const responseText = response.text();
        console.log("Raw timestamp JSON response:", responseText);
        const parsed = JSON.parse(responseText) as TimestampResponse;
        const timestamps = parsed.timestamps || [];
        console.log(`--- TOOL RESULT: Found timestamps: [${timestamps.join(', ')}] ---`);
        return { relevantTimestamps: timestamps };
    } catch (error) {
        console.error("Error during find_relevant_timestamps transactional call:", error);
        console.log("Returning empty timestamp array due to error.");
        return { relevantTimestamps: [] };
    }
}

/**
 * Tool 2: Answers query using timestamps and image context via a multimodal LLM call.
 */
async function answer_user_query(
    { userQuery, relevantTimestamps }: { userQuery: string, relevantTimestamps: string[] },
    model: GenerativeModel // Pass model instance for multimodal call
): Promise<{ answerText: string }> {
    console.log(`\n--- TOOL CALL: answer_user_query ---`);
    console.log(`Answering query "${userQuery}" using timestamps: [${relevantTimestamps.join(', ')}]`);

    // Simulate fetching frames by loading the placeholder storyboard. In a real implementation
    // this would actually sample the frames and build the storyboard for the given relevantTimestamps.
    console.log("Simulating fetching relevant video frames (loading storyboard)...");
    const imagePart = await loadImageBase64(STORYBOARD_IMAGE_PATH);

    // Prepare multimodal prompt for the transactional call
    const transactionalPrompt = `Based on the provided image (representing relevant video frames), the timestamped video descriptions and the original user query, please answer the query.

User Query: "${userQuery}"

** Video Descriptions **
${VIDEO_DESCRIPTIONS}
`;

    const request: GenerateContentRequest = {
        contents: [{
            role: "user",
            parts: [
                { text: transactionalPrompt },
                imagePart
            ]
        }],
    };

    try {
        console.log("Making multimodal call to Gemini...");
        const result = await model.generateContent(request); // Multimodal call
        const response = result.response;
        const answerText = response.text();
        console.log(`--- TOOL RESULT: Generated Answer: "${answerText}" ---`);
        return { answerText: answerText };
    } catch (error) {
        console.error("Error during answer_user_query transactional call:", error);
        return { answerText: "Sorry, I encountered an error analyzing the visual context." };
    }
}

// --- Tool Definitions ---
const findRelevantTimestampsTool: FunctionDeclaration = {
    name: "find_relevant_timestamps",
    description: "Analyzes video text descriptions to find timestamps relevant to a specific user query about the video's content.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            userQuery: {
                type: SchemaType.STRING,
                description: "The user's question about the video content."
            }
        },
        required: ["userQuery"]
    }
};

const answerUserQueryTool: FunctionDeclaration = {
    name: "answer_user_query",
    description: "Answers a user's query using specific timestamps by analyzing the corresponding visual context (video frames/images). Call this AFTER find_relevant_timestamps.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            userQuery: {
                type: SchemaType.STRING,
                description: "The original user's question."
            },
            relevantTimestamps: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "The array of timestamps identified as relevant by the find_relevant_timestamps tool."
            }
        },
        required: ["userQuery", "relevantTimestamps"]
    }
};

// --- System Instruction Definition ---
const SYSTEM_INSTRUCTION = `You are a helpful video assistant. You can answer questions about the video content.
You have access to text descriptions of the video, but not the video frames directly initially.

WHEN THE USER ASKS A QUESTION ABOUT SPECIFIC DETAILS OR EVENTS IN THE VIDEO (e.g., "What is someone wearing?", "What happens at time X?", "Show me when Y occurs"):
1.  **Identify Relevant Times:** First, call the 'find_relevant_timestamps' tool, passing the user's query. This tool will find potentially relevant moments based on text descriptions.
2.  **Analyze Visuals:** Next, call the 'answer_user_query' tool. Pass it the *original* user query AND the 'relevantTimestamps' array returned by the first tool. This second tool will examine the visual information at those times to find the answer.
3.  **Respond:** Formulate a final response to the user based *only* on the answer provided by the 'answer_user_query' tool. Do not add information not present in that tool's response.

If the user asks a general question that doesn't require looking at specific moments or visual details, answer directly based on your general knowledge or the conversation history.`;

// --- Main Execution Logic ---
async function main() {
    let apiKey: string;
    try {
        apiKey = await getApiKey();
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }

    console.log("\nInitializing Model for Video Assistant Chat...");
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use a model supporting function calling and multimodal input
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [findRelevantTimestampsTool, answerUserQueryTool] }],
    });

    // Model for transcational calls
    const transactionalModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // --- Start the Chat Session ---
    const chat: ChatSession = model.startChat({
        history: []
    });

    console.log("Chat session started.");
    console.log(`(Using placeholder image: ${STORYBOARD_IMAGE_PATH})`);

    // --- Simulate User Query ---
    const userQuery = "What is Sundar Pichai wearing?";
    console.log(`\nUser: ${userQuery}`);

    try {
        let result = await chat.sendMessage(userQuery); // Send initial user query

        // --- Function Calling Handling Loop ---
        let loopCount = 0;
        const MAX_LOOPS = 5; // Prevent infinite loops

        while (loopCount < MAX_LOOPS) {
            loopCount++;
            const response = result.response;
            const functionCalls = response.candidates?.[0]?.content?.parts
                ?.filter(part => !!part.functionCall)
                .map(part => part.functionCall);

            if (!functionCalls || functionCalls.length === 0) {
                // No function call, break loop and respond with text
                console.log(`\nAssistant (Final Answer): ${response.text()}`);
                break;
            }

            // We got function call(s) - process the first one
            // (Gemini currently only returns one function call per turn)
            const fnCall = functionCalls[0];
            const { name, args } = fnCall;
            console.log(`\nAssistant requested Function Call ${loopCount}: ${name}`);

            let apiResponse: any;
            let functionResponsePart: FunctionResponsePart | null = null;

            // Execute the corresponding local function
            if (name === "find_relevant_timestamps") {
                apiResponse = await find_relevant_timestamps(args as { userQuery: string }, transactionalModel);
                functionResponsePart = {
                    functionResponse: { name, response: apiResponse }
                };
            } else if (name === "answer_user_query") {
                apiResponse = await answer_user_query(args as { userQuery: string, relevantTimestamps: string[] }, transactionalModel); // Pass model instance
                functionResponsePart = {
                    functionResponse: { name, response: apiResponse }
                };
            } else {
                console.warn(`Received unexpected function call: ${name}`);
                // Optional: Send error back to model? For now, just break loop.
                break;
            }

            // Send the function response back to the model
            if (functionResponsePart) {
                console.log(`Sending Function Response [${name}] back to model...`);
                result = await chat.sendMessage([functionResponsePart]);
            } else {
                // Should not happen if name matched
                console.error("Error preparing function response part.");
                break;
            }

            // Check if max loops reached (safety break)
            if(loopCount >= MAX_LOOPS) {
                 console.warn("Maximum function call loops reached.");
                 break;
            }

        } // End while loop

        if(loopCount >= MAX_LOOPS) {
            console.error("Exited loop due to maximum iterations.");
            // Optionally display the last known response text
             const lastResponseText = result.response.text();
             if (lastResponseText) {
                console.log(`Assistant (Last): ${lastResponseText}`);
            }
        }

    } catch (error: any) {
        console.error("\n--- ERROR DURING CHAT OR PROCESSING ---");
        console.error("Error message:", error.message);
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