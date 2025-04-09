import {
    GoogleGenerativeAI,
    GenerativeModel,
    ChatSession,
    SchemaType,
    FunctionDeclaration,
    FunctionResponsePart,
    GenerateContentRequest
} from "@google/generative-ai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// --- Interfaces and Types ---
// Simulates an interface representing an APP. This can extend to any settings
// but for this example we are using some of them focused on accessibility.
interface AppSettings {
    darkMode: boolean;
    fontSizeFactor: number; // e.g., 0.8 to 2.0
    notificationsEnabled: boolean;
    notificationVolume: number; // 0.0 to 1.0
    reduceMotion: boolean;
    autoPlayVideos: boolean;
    highContrast: boolean;
    textToSpeechRate: number; // e.g., 0.5 to 2.0
}

interface SettingDefinition {
    key: keyof AppSettings;
    description: string;
    examples: string[];
}

// --- App Settings Definitions ---
// Describes each setting for the LLM (used in update_app_settings tool)
const SETTING_DEFINITIONS: SettingDefinition[] = [
    {
        key: "darkMode",
        description: "Display mode. Boolean: 'true' for dark background with light text, 'false' for light background with dark text. Useful for light sensitivity or preference.",
        examples: ["Enable dark mode", "Switch to light mode", "My eyes hurt from the bright screen", "I have photophobia"]
    },
    {
        key: "fontSizeFactor",
        description: "Text size multiplier. Number between 0.8 (smaller) and 2.0 (larger), default 1.0. Increases or decreases default text size.",
        examples: ["Make text bigger", "Increase font size", "Shrink the text", "I find it hard to read this"]
    },
    {
        key: "notificationsEnabled",
        description: "Master toggle for all app notifications. Boolean: 'true' to allow notifications, 'false' to block all.",
        examples: ["Turn off notifications", "Enable notifications", "I am not getting any notifications", "Disable notifications", "I don't want to be notified"]
    },
    {
        key: "notificationVolume",
        description: "Volume for notification sounds. Number between 0.0 (muted) and 1.0 (max volume). Requires notificationsEnabled=true.",
        examples: ["Make notifications louder", "Mute notification sounds", "Turn down the alert volume", "Can barely hear the pings"]
    },
    {
        key: "reduceMotion",
        description: "Reduces non-essential animations and motion effects. Boolean: 'true' to reduce motion, 'false' for standard animations. Helps users sensitive to motion.",
        examples: ["Reduce motion effects", "Turn off animations", "Too much movement on screen", "I get dizzy easily", "Turn on animation", "Turn on effects"]
    },
    {
        key: "autoPlayVideos",
        description: "Controls if videos play automatically. Boolean: 'true' to autoplay, 'false' to require manual play.",
        examples: ["Stop videos from playing automatically", "Enable video autoplay", "Don't play videos unless I click", "I don't want videos start on their own"]
    },
    {
        key: "highContrast",
        description: "Increases color contrast between text and background. Boolean: 'true' for high contrast mode, 'false' for standard contrast. Aids users with low vision.",
        examples: ["Enable high contrast mode", "Increase contrast", "Make text stand out more", "Colors are hard to distinguish"]
    },
    {
        key: "textToSpeechRate",
        description: "Speed for screen reader voice. Number between 0.5 (slower) and 2.0 (faster), default 1.0.",
        examples: ["Speak faster", "Slow down the reading speed", "Adjust voice speed", "Make the text-to-speech slower"]
    }
];

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

// --- Tool Implementations ---

// Simulates fetching the current application settings
async function get_current_app_settings(): Promise<AppSettings> {
    console.log("\n--- TOOL CALL: get_current_app_settings ---");
    // In a real app, this would read from storage (e.g., localStorage, database)
    const currentSettings: AppSettings = {
        darkMode: false,
        fontSizeFactor: 1.0,
        notificationsEnabled: true,
        notificationVolume: 0.7,
        reduceMotion: false,
        autoPlayVideos: true,
        highContrast: false,
        textToSpeechRate: 1.0,
    };
    console.log("Current Settings:", JSON.stringify(currentSettings));
    console.log("--- TOOL RESULT: Returning current settings ---");
    return currentSettings;
}

/**
 * Tool: Calculates new settings using a transactional call.
 * Needs access to a model instance and setting definitions.
 */
async function update_app_settings(
    { currentSettings, userRequest }: { currentSettings: AppSettings, userRequest: string },
    model: GenerativeModel, // Pass model instance for transactional call
    settingDefinitions: SettingDefinition[] // Pass definitions
): Promise<AppSettings> {
    console.log(`\n--- TOOL CALL: update_app_settings ---`);
    console.log(`User Request: "${userRequest}"`);
    console.log(`Current Settings:`, JSON.stringify(currentSettings));

    // Prepare detailed descriptions for the transactional prompt
    const descriptions = settingDefinitions.map(
        d => `Setting Key: "${d.key}"\nDescription: ${d.description}\nCurrent Value: ${JSON.stringify(currentSettings[d.key])}\nExamples for Change: ${d.examples.join(', ')}`
    ).join('\n\n');

    const transactionalPrompt = `Analyze the user request based on the current application settings and their descriptions provided below. Determine which settings need to change and calculate their new values based on the request (explicit or implicit). Infer reasonable changes (e.g., increase font factor by 0.2 for 'bigger font', set dark mode to true for 'light sensitivity'). Adhere to value ranges/types mentioned in descriptions.

Return ONLY a single JSON object representing the *complete set* of application settings with the updated values. Ensure the output matches the AppSettings structure (boolean, number).

Current Settings Object:
${JSON.stringify(currentSettings, null, 2)}

Setting Descriptions:
---
${descriptions}
---

User Request: "${userRequest}"

Required JSON Output Format (Complete AppSettings Object):
{
  "darkMode": boolean,
  "fontSizeFactor": number (0.8-2.0),
  "notificationsEnabled": boolean,
  "notificationVolume": number (0.0-1.0),
  "reduceMotion": boolean,
  "autoPlayVideos": boolean,
  "highContrast": boolean,
  "textToSpeechRate": number (0.5-2.0)
}`;

    const request: GenerateContentRequest = {
        contents: [{ role: "user", parts: [{ text: transactionalPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            // Define schema for the AppSettings object
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    darkMode: { type: SchemaType.BOOLEAN },
                    fontSizeFactor: { type: SchemaType.NUMBER },
                    notificationsEnabled: { type: SchemaType.BOOLEAN },
                    notificationVolume: { type: SchemaType.NUMBER },
                    reduceMotion: { type: SchemaType.BOOLEAN },
                    autoPlayVideos: { type: SchemaType.BOOLEAN },
                    highContrast: { type: SchemaType.BOOLEAN },
                    textToSpeechRate: { type: SchemaType.NUMBER },
                },
                required: Object.keys(currentSettings) as (keyof AppSettings)[]
            }
        }
    };

    try {
        console.log("Making transactional call to determine new settings...");
        const result = await model.generateContent(request);
        const response = result.response;
        const responseText = response.text();
        console.log("Raw proposed settings JSON response:", responseText);
        const proposedSettings = JSON.parse(responseText) as AppSettings;

        // Basic validation (to make sure the values remain valid, Gemini would do its best but we need to guarantee the app won't break)
        proposedSettings.fontSizeFactor = Math.max(0.8, Math.min(2.0, proposedSettings.fontSizeFactor));
        proposedSettings.notificationVolume = Math.max(0.0, Math.min(1.0, proposedSettings.notificationVolume));
        proposedSettings.textToSpeechRate = Math.max(0.5, Math.min(2.0, proposedSettings.textToSpeechRate));

        console.log("Proposed Settings (validated):", JSON.stringify(proposedSettings));
        console.log(`--- TOOL RESULT: Returning proposed settings ---`);
        return proposedSettings;
    } catch (error) {
        console.error("Error during update_app_settings transactional call:", error);
        console.log("Returning current settings due to error.");
        return currentSettings; // Return original settings on error
    }
}

// --- Tool Declarations ---
const getCurrentSettingsTool: FunctionDeclaration = {
    name: "get_current_app_settings",
    description: "Retrieves the current values of all application settings.",
    parameters: { type: SchemaType.OBJECT, properties: {} } // No parameters needed
};

const updateSettingsTool: FunctionDeclaration = {
    name: "update_app_settings",
    description: "Calculates and proposes updated application settings based on the user's request and the current settings state. Should be called after getting the current settings.",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            currentSettings: {
                type: SchemaType.OBJECT,
                // Dynamically generate properties from AppSettings keys
                properties: SETTING_DEFINITIONS.reduce((acc, setting) => {
                    acc[setting.key] = { type: setting.key === 'darkMode' || setting.key === 'notificationsEnabled' || setting.key === 'reduceMotion' || setting.key === 'autoPlayVideos' || setting.key === 'highContrast' ? SchemaType.BOOLEAN : SchemaType.NUMBER };
                    return acc;
                }, {} as any), // Cast to any for dynamic property building
                required: SETTING_DEFINITIONS.map(s => s.key),
                description: "The current state of all application settings, obtained via get_current_app_settings."
            },
            userRequest: {
                type: SchemaType.STRING,
                description: "The original user query or statement indicating desired changes (can be explicit or implicit)."
            }
        },
        required: ["currentSettings", "userRequest"]
    }
};

// --- System Instruction Definition ---
const SYSTEM_INSTRUCTION = `You are an AI assistant helping users manage application settings.

WHEN THE USER EXPRESSES A DESIRE TO CHANGE SETTINGS (either explicitly like "increase font size" or implicitly like "it's hard to read" or "my eyes are sensitive"):
1.  **Get Current State:** First, call the 'get_current_app_settings' function to retrieve the current settings values.
2.  **Calculate New State:** Next, call the 'update_app_settings' function. Pass the *complete* 'currentSettings' object you received from the first function, and also pass the user's *original request* text as 'userRequest'. This function will determine the appropriate new settings.
3.  **Confirm/Inform:** After the 'update_app_settings' function returns the proposed new settings, inform the user clearly about the changes that were made or proposed based on their request. If no changes were needed, inform them of that too.

For general chat or questions not related to settings, respond conversationally.`;

// --- Main Execution Logic ---
async function main() {
    let apiKey: string;
    try {
        apiKey = await getApiKey();
    } catch (error: any) {
        console.error(error.message);
        process.exit(1);
    }

    console.log("\nInitializing Model for App Settings Chat...");
    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [getCurrentSettingsTool, updateSettingsTool] }],
    });

    const transactionalModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // --- Start the Chat Session ---
    const chat: ChatSession = model.startChat({
        history: []
    });

    console.log("Chat session started.");

    // --- Get User Query ---
    const defaultQuery = "My eyes are sensitive to light and I need a bigger font size.";
    const rlQuery = readline.createInterface({ input, output });
    let userQuery = await rlQuery.question(`\nEnter your settings request (or press Enter for default: "${defaultQuery}"): `);
    rlQuery.close();
    userQuery = userQuery.trim() || defaultQuery;
    console.log(`\nUser: ${userQuery}`);

    try {
        let result = await chat.sendMessage(userQuery); // Send initial user query

        // --- Function Calling Handling Loop ---
        let loopCount = 0;
        const MAX_LOOPS = 5;
        let currentSettingsData: AppSettings | null = null;

        while (loopCount < MAX_LOOPS) {
            loopCount++;
            const response = result.response;
            const functionCalls = response.candidates?.[0]?.content?.parts
                ?.filter(part => !!part.functionCall)
                .map(part => part.functionCall);

            if (!functionCalls || functionCalls.length === 0) {
                console.log(`\nAssistant (Final Response): ${response.text()}`);
                break;
            }

            const fnCall = functionCalls[0];
            const { name, args } = fnCall;
            console.log(`\nAssistant requested Function Call ${loopCount}: ${name}`);

            let apiResponse: any;
            let functionResponsePart: FunctionResponsePart | null = null;

            if (name === "get_current_app_settings") {
                apiResponse = await get_current_app_settings();
                currentSettingsData = apiResponse; // <-- Store the fetched settings
                functionResponsePart = { functionResponse: { name, response: apiResponse } };
            } else if (name === "update_app_settings") {
                // Ensure we have current settings and the original query
                if (!currentSettingsData) {
                    throw new Error("Cannot call update_app_settings without current settings. get_current_app_settings must be called first.");
                }
                // We need the *original* user query here, not processed args
                const toolArgs = {
                    currentSettings: currentSettingsData,
                    userRequest: userQuery // Pass original query
                };
                apiResponse = await update_app_settings(toolArgs, transactionalModel, SETTING_DEFINITIONS);
                functionResponsePart = { functionResponse: { name, response: apiResponse } };
            } else {
                console.warn(`Received unexpected function call: ${name}`);
                break;
            }

            if (functionResponsePart) {
                console.log(`Sending Function Response [${name}] back to model...`);
                result = await chat.sendMessage([functionResponsePart]);
            } else {
                console.error("Error preparing function response part.");
                break;
            }

            if (loopCount >= MAX_LOOPS) {
                 console.warn("Maximum function call loops reached.");
                 break;
            }
        } // End while loop

        if(loopCount >= MAX_LOOPS) {
            console.error("Exited loop due to maximum iterations.");
            const lastResponseText = result.response.text();
             if (lastResponseText) console.log(`Assistant (Last): ${lastResponseText}`);
        }

    } catch (error: any) {
        console.error("\n--- ERROR DURING CHAT OR PROCESSING ---");
        console.error("Error message:", error.message);
         if(error.response?.candidates) console.error("Response Candidates:", JSON.stringify(error.response.candidates, null, 2));
        console.error("---------------------------------------\n");
    }
} // End main

// Run the main function
main().catch(error => {
    console.error("Unhandled error during execution:", error);
    process.exit(1);
});