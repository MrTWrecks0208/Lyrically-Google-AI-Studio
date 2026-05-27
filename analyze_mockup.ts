import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No API key found in environment");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function analyzeFile(fileName: string) {
    const filePath = path.join(process.cwd(), "public", fileName);
    if (!fs.existsSync(filePath)) return null;

    console.log(`Analyzing file: ${fileName} (${fs.statSync(filePath).size} bytes)`);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: "image/png"
                    }
                },
                {
                    text: `Identify if this is a user interface mockup of a songwriting app, or if it is just a logo/brand mark. If it is a user interface screenshot/mockup, describe the entire layout, components, buttons, colors, and layout structure in extreme detail so we can duplicate it. If it is just a logo, state that clearly and briefly describe its contents.`
                }
            ]
        });
        return response.text;
    } catch (err) {
        console.error(`Error analyzing ${fileName}:`, err);
        return null;
    }
}

async function main() {
    const files = ["Logo.png", "Lyrically-Logo.png", "Lyrically.png", "Lyrically_Logo+Wordmark_T.png", "Wordmark.png"];
    for (const file of files) {
        console.log(`\n------------------`);
        const desc = await analyzeFile(file);
        if (desc) {
            console.log(`=== Result for ${file} ===`);
            console.log(desc);
        }
    }
}

main();
