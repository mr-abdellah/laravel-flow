import { AISchema } from "./generators";

export const generateSchemaWithAI = async (
  prompt: string,
  apiKey: string,
  model: string = "llama-3.3-70b-versatile"
): Promise<AISchema> => {
  const systemPrompt = `
You are a Laravel Database Architect. 
Your goal is to generate a database schema based on the user's description.
You MUST return ONLY a valid JSON object. Do not include any markdown formatting, explanations, or code blocks.
The JSON must follow this exact structure:

{
  "tables": [
    {
      "name": "table_name_plural",
      "columns": [
        { "name": "column_name", "type": "laravel_column_type", "nullable": boolean }
      ]
    }
  ],
  "relations": [
    {
      "fromModel": "ModelName",
      "type": "hasMany|belongsTo|hasOne|belongsToMany",
      "toModel": "RelatedModelName",
      "methodName": "relationMethodName"
    }
  ]
}

Rules:
1. Always include 'id' (bigIncrements/id) for every table.
2. Use standard Laravel column types (string, text, integer, boolean, foreignId, timestamp, date, etc.).
3. Infer relationships based on the description.
4. "fromModel" and "toModel" should be PascalCase (e.g., "User", "Post").
5. "name" in tables should be snake_case plural (e.g., "users", "blog_posts").
`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.1, // Low temperature for consistent JSON
        response_format: { type: "json_object" }, // Force JSON mode if supported
      }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to generate schema");
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return JSON.parse(content);
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw error;
  }
};
