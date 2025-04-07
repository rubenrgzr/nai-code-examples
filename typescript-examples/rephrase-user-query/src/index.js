"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const generative_ai_1 = require("@google/generative-ai");
const readline = __importStar(require("node:readline/promises"));
const node_process_1 = require("node:process");
var QueryClassification;
(function (QueryClassification) {
    QueryClassification["INFORMATION_SEEKING"] = "INFORMATION_SEEKING";
    QueryClassification["UPDATE_APP_SETTINGS"] = "UPDATE_APP_SETTINGS";
    QueryClassification["OTHER"] = "OTHER";
})(QueryClassification || (QueryClassification = {}));
const classifications = [
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
function getApiKey() {
    return __awaiter(this, void 0, void 0, function* () {
        const rl = readline.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
        console.log("\n---------------------------------------------------------------");
        console.log("This example requires a Google Gemini API Key.");
        console.log("Generate one at: https://aistudio.google.com/app/apikey");
        console.log("---------------------------------------------------------------");
        const apiKey = yield rl.question('Paste your API Key here and press Enter: ');
        rl.close();
        if (!apiKey || apiKey.trim().length === 0) {
            console.error("\nAPI Key is required to proceed. Exiting.");
            process.exit(1);
        }
        return apiKey.trim();
    });
}
function getUserQuery() {
    return __awaiter(this, void 0, void 0, function* () {
        const rl = readline.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
        const query = yield rl.question(`Enter the user query you want to classify into any of the following
                                     categories:  INFORMATION_SEEKING, UPDATE_APP_SETTINGS or OTHER`);
        rl.close();
        if (!query || query.trim().length === 0) {
            console.error("\nQuery cannot be empty. Exiting.");
            process.exit(1);
        }
        return query.trim();
    });
}
function classifyQuery(model, query) {
    return __awaiter(this, void 0, void 0, function* () {
        const classificationDetails = classifications.map((c) => `${c.name}: ${c.description} (Examples: ${c.examples.join(', ')})`).join('\n- ');
        const prompt = `Classify the following user query into one or more of the following categories:
- ${classificationDetails}

User Query: "${query}"

Return a JSON object with a single field "query_classification" which is an array of the classifications from the provided list that best describe the user query.`;
        try {
            const result = yield model.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: generative_ai_1.SchemaType.OBJECT,
                        properties: {
                            response: {
                                type: generative_ai_1.SchemaType.ARRAY,
                                items: {
                                    type: generative_ai_1.SchemaType.OBJECT,
                                    properties: {
                                        query_classification: {
                                            type: generative_ai_1.SchemaType.STRING,
                                            format: "enum",
                                            enum: [
                                                'INFORMATIONAL_QUERY',
                                                'VIDEO_PLAYER_ACTION',
                                                'APP_SETTINGS',
                                                'VIDEO_SPECS',
                                                'PROTOTYPE_HELP',
                                            ],
                                        }
                                    }
                                }
                            }
                        },
                        required: ['responseType'],
                    },
                },
            });
            const response = result.response;
            if (!response || !response.text) {
                console.warn("No response text received from the model.");
                return null;
            }
            try {
                const parsedResponse = JSON.parse(response.text());
                if (!parsedResponse || !Array.isArray(parsedResponse.query_classification) || parsedResponse.query_classification.length === 0) {
                    console.warn("Invalid classification response format or empty classifications.");
                    console.log("Raw response:", response.text);
                    return null;
                }
                return parsedResponse;
            }
            catch (error) {
                console.error("Error parsing classification response:", error);
                console.log("Raw response:", response.text);
                return null;
            }
        }
        catch (error) {
            console.error("Error calling the Gemini API:", error);
            return null;
        }
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const apiKey = yield getApiKey();
        const userQuery = yield getUserQuery();
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const classificationResult = yield classifyQuery(model, userQuery);
        if (classificationResult) {
            console.log("\n--- Classification Result ---");
            console.log("Query:", userQuery);
            console.log("Classifications:", classificationResult.query_classification);
            console.log("---------------------------\n");
        }
        else {
            console.log("\nCould not classify the query.\n");
        }
    });
}
main();
