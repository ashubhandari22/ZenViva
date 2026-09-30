"""
ai/question_generator.py
This module connects to the Google Gemini AI to generate a list of interview questions.
It takes the user's settings (role, skills, difficulty, etc.) and prompts the AI
to return a structured JSON response containing the questions.
"""
import os
import json
from google import genai
from google.genai import types

def generate_questions(role, experience, skills, interview_type, difficulty, num_questions, resume_text=""):
    """
    Generates interview questions using Gemini based on the provided parameters.
    Returns a Python dictionary with the questions.
    """
    try:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key or "your_gemini_api_key_here" in api_key:
            raise ValueError("GEMINI_API_KEY is not configured or is placeholder.")

        # Initialize the client with the provided API key
        client = genai.Client(api_key=api_key)

        # Construct the prompt
        prompt = f"""
        You are an expert AI interview coach. Generate {num_questions} interview questions for a {experience} level {role}.
        The candidate has the following skills: {skills}.
        The interview type is {interview_type}. The difficulty should be {difficulty}.
        """
        if resume_text:
            prompt += f"\nBase some questions on this resume extract: {resume_text}"
            
        prompt += """
        Return the response as a JSON object matching this schema:
        {
          "questions": [
            {
              "question": "The question text",
              "type": "technical or hr",
              "topic": "The specific topic, e.g., Python, Teamwork",
              "difficulty": "easy, medium, or hard"
            }
          ]
        }
        Make sure the questions are highly relevant, professional, and do not contain inappropriate content.
        """

        import re
        import time
        # Use gemini-3.8-flash with fallback to gemini-3.1-pro-preview and exponential backoff
        response = None
        models_to_try = ['gemini-3.8-flash', 'gemini-3.1-pro-preview']
        for model_name in models_to_try:
            for attempt in range(3):
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                        ),
                    )
                    if response and response.text:
                        break
                except Exception as model_err:
                    print(f"Notice: Model {model_name} attempt {attempt + 1} failed: {model_err}")
                    time.sleep(1.5 * (attempt + 1))
            if response and response.text:
                break

        if not response or not response.text:
            raise RuntimeError("Empty response received from Gemini API.")

        # Strip any markdown code fences if present
        raw_text = response.text.strip()
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
        raw_text = re.sub(r"\s*```$", "", raw_text)

        # Parse the JSON string returned by the model into a Python dictionary
        questions_data = json.loads(raw_text)
        if isinstance(questions_data, dict) and "questions" in questions_data and isinstance(questions_data["questions"], list):
            return questions_data
        elif isinstance(questions_data, list):
            return {"questions": questions_data}
        return questions_data
    except Exception as e:
        print(f"Notice: Using fallback questions generator ({e})")
        # Return intelligent role-specific fallbacks if API key is not configured or network fails
        primary_skill = skills.split(',')[0].strip() if skills else role
        fallback_pool = [
            {
                "question": f"Could you walk me through your experience as a {role} and highlight your primary projects utilizing {primary_skill}?",
                "type": "technical" if interview_type != "HR" else "hr",
                "topic": "Background & Core Skills",
                "difficulty": difficulty.lower()
            },
            {
                "question": f"How do you design, optimize, and troubleshoot complex workflows when working with {primary_skill}?",
                "type": "technical" if interview_type != "HR" else "hr",
                "topic": "Architecture & Troubleshooting",
                "difficulty": difficulty.lower()
            },
            {
                "question": "Tell me about a time you encountered a severe production bug or project roadblock. How did you diagnose and resolve it?",
                "type": "hr" if interview_type == "HR" else "technical",
                "topic": "Problem Solving & Resilience",
                "difficulty": difficulty.lower()
            },
            {
                "question": "How do you navigate differing opinions within your engineering or cross-functional team when deciding on architecture or design patterns?",
                "type": "hr",
                "topic": "Teamwork & Collaboration",
                "difficulty": "medium"
            },
            {
                "question": f"What testing, security, and scalability standards do you consider critical when shipping production systems as a {role}?",
                "type": "technical" if interview_type != "HR" else "hr",
                "topic": "Quality & Scalability",
                "difficulty": difficulty.lower()
            }
        ]

        # Return requested number of questions
        selected_questions = fallback_pool[:num_questions]
        while len(selected_questions) < num_questions:
            selected_questions.append({
                "question": f"What emerging trend or technical advancement in {primary_skill} are you most excited to leverage, and why?",
                "type": "technical" if interview_type != "HR" else "hr",
                "topic": "Continuous Learning",
                "difficulty": difficulty.lower()
            })

        return {"questions": selected_questions}

