import { GoogleGenerativeAI, GenerativeModel, SchemaType } from "@google/generative-ai";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

enum QueryClassification {
    INFORMATION_SEEKING = "INFORMATION_SEEKING",
    UPDATE_APP_SETTINGS = "UPDATE_APP_SETTINGS",
    OTHER = "OTHER",
}

interface ClassificationDefinition {
    name: QueryClassification;
    description: string;
    examples: string[];
}

const classifications: ClassificationDefinition[] = [
    {
        name: QueryClassification.INFORMATION_SEEKING,
        description: "The user is asking for factual information or explanations.",
        examples: [
            "What is the capital of France?",
            "Explain how photosynthesis works.",
            "Tell me about the latest news on AI.",
        ],
    },
    {
        name: QueryClassification.UPDATE_APP_SETTINGS,
        description: `The user wants to modify settings or preferences within an application.
                      The current supported settings are:
                      * Darkmode (or lighmode): Users can pick their preferred mode. Some users may
                        use darkmode if they are sensitive to light or have any other conditions that may
                        them decide for a more dark interface or just by preference. Some other users will
                        prefer the light mode.
                      * Font size: The application supports a range of 0.5 to 2.0 for font magnification.
                        This is a factor that will allow them to reduce or increase the default font size
                        by a specific factor. Some users will prefer a bigger font size specially if they
                        have complications reading small text. Other users may prefer even a smaller size
                        to fit more content on the screen.
                      * Notifications: User can change the volume of the notifications within a range of
                        0 (muted) up to 1 (maximum volume). Users with hearing loss may benefit from
                        having the maximum volume while other users may prefer to not be interruped
                        and mute the notifications.`,
        examples: [
            "Turn on dark mode.",
            "Enable light mode.",
            "Increase the font size.",
            "Decrease the text size.",
            "Change the notification sound.",
            "Mute notifications.",
            "Adjust the volume.",
            "I have light sensitivity.",
            "I have difficulty reading small text.",
            "I have low vision.",
            "I don't like to be interrupted by notifications."
        ],
    },
    {
        name: QueryClassification.OTHER,
        description: "The user's query does not fit into any of the other defined categories.",
        examples: [
            "Hello.",
            "Thank you.",
            "That's interesting.",
        ],
    },
];

interface ClassificationResponse {
    response: Array<{queryClassification: QueryClassification, reason: string}>
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

async function getUserQuery(): Promise<string> {
    const rl = readline.createInterface({ input, output });
    const query = await rl.question('Enter the user query you want to classify into any of the following categories:  INFORMATION_SEEKING, UPDATE_APP_SETTINGS or OTHER: ');
    rl.close();
    if (!query || query.trim().length === 0) {
        console.error("\nQuery cannot be empty. Exiting.");
        process.exit(1);
    }
    return query.trim();
}

async function classifyQuery(model: GenerativeModel, query: string): Promise<ClassificationResponse | null> {
    const classificationDetails = classifications.map(
        (c) => `${c.name}: ${c.description} (Examples: ${c.examples.join(', ')})`
    ).join('\n- ');

    const prompt = `Classify the following user query into one or more of the following categories:
- ${classificationDetails}

User Query: "${query}"

Return a JSON object with a field "queryClassification" which is an array of the classifications from the provided list that best describe the user query along 
with the "reason" of why the classification is a match, e.g. because the user query mentions ...`;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    response: {
                        type: SchemaType.ARRAY,
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                queryClassification: {
                                    type: SchemaType.STRING,
                                    format: "enum",
                                    enum:  Object.values(QueryClassification),
                                },
                                reason: {
                                    type: SchemaType.STRING,
                                }
                            },
                            required: ['queryClassification', 'reason'],
                        }
                    }
                },
                required: ['response'],
                },
            },
        });
        const response = result.response;
        if (!response || !response.text) {
            console.warn("No response text received from the model.");
            return null;
        }
        try {
            const parsedResponse = JSON.parse(response.text()) as ClassificationResponse;
            if (!parsedResponse || !Array.isArray(parsedResponse.response) || parsedResponse.response.length === 0) {
                console.warn("Invalid classification response format or empty classifications.");
                console.log("Raw response:", response.text());
                return null;
            }
            return parsedResponse;
        } catch (error) {
            console.error("Error parsing classification response:", error);
            console.log("Raw response:", response.text());
            return null;
        }
    } catch (error: any) {
        console.error("Error calling the Gemini API:", error);
        return null;
    }
}

async function main() {
    const apiKey = await getApiKey();
    const userQuery = await getUserQuery();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const classificationResult = await classifyQuery(model, userQuery);

    if (classificationResult) {
        console.log("\n--- Classification Result ---");
        console.log("Query:", userQuery);
        console.log("Classifications:", classificationResult.response.map(c => `${c.queryClassification}: ${c.reason}`));
        console.log("---------------------------\n");
    } else {
        console.log("\nCould not classify the query.\n");
    }
}

main();

