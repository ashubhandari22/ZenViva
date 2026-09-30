# ZenViva - AI Interview & Career Coach

## Description
ZenViva is a modern, interactive Python web application that helps candidates prepare for their upcoming job interviews. By leveraging the power of Google Gemini AI, ZenViva generates tailored technical and HR interview questions based on the candidate's chosen role, experience, and skills. It also provides instant, detailed feedback on the candidate's answers using a 4-dimensional AI Evaluation Matrix, scoring them out of 10 and offering actionable suggestions for improvement.

## Features
- **Customizable Interview Setup**: Choose from various job roles, experience levels, and difficulty settings.
- **AI Question Generation**: Context-aware questions generated on the fly.
- **Real-time Feedback**: Detailed evaluation, scoring, and sample model answers for every question.
- **Dynamic Follow-up Questions**: The AI asks contextual follow-ups based on your previous answers to simulate a real conversation.
- **Resume Upload Integration**: Extract text from PDF resumes to generate highly personalized questions.
- **Performance Analytics**: View your overall practice score and topic-wise breakdown using interactive charts.
- **History Dashboard**: Track your progress over time with a locally stored interview history.

## Technology Stack
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript, Chart.js
- **Backend**: Python 3, Flask
- **AI Integration**: Google Gemini API (`google-genai`)
- **Database**: SQLite (via Python `sqlite3`)
- **PDF Processing**: PyPDF2

## Project Architecture
The project is structured to be simple and easy for beginner Python developers to understand:

```
AI-Interview-Coach/
│
├── app.py                   # Main Flask application and routing
├── requirements.txt         # Python dependencies
├── .env.example             # Example environment variables file
├── .gitignore               # Files to ignore in Git version control
├── README.md                # Project documentation
│
├── database/
│   └── database.py          # SQLite database initialization and queries
│
├── ai/
│   ├── question_generator.py # Logic for prompting Gemini to generate questions
│   └── evaluator.py          # Logic for prompting Gemini to evaluate answers
│
├── utils/
│   └── resume_parser.py      # PyPDF2 logic to extract text from PDF resumes
│
├── templates/                # Jinja2 HTML templates for the frontend
│   ├── index.html            # Landing page and setup form
│   ├── interview.html        # The main interview screen
│   ├── result.html           # Final scoring and topic breakdown page
│   └── dashboard.html        # History of past interviews
│
├── static/
│   ├── css/
│   │   └── style.css         # Modern styling and variables
│   │
│   └── js/
│       └── script.js         # Frontend interactions and API fetching
│
├── uploads/                  # Temporary storage for uploaded PDF resumes
│
└── data/                     # Storage for the SQLite database
    └── interviews.db
```

## Installation

1. **Clone the repository** (if using Git):
   ```bash
   git clone <your-repo-url>
   cd AI-Interview-Coach
   ```

2. **Create a virtual environment (Recommended)**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install the required packages**:
   ```bash
   pip install -r requirements.txt
   ```

## Environment Variables

The application requires an API key to communicate with the Google Gemini AI.

1. Create a copy of `.env.example` and name it `.env`:
   ```bash
   # On Windows:
   copy .env.example .env
   # On macOS/Linux:
   cp .env.example .env
   ```

2. Open `.env` and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   FLASK_SECRET_KEY=a_random_secret_string_for_sessions
   ```
   *(You can get a free Gemini API key from Google AI Studio).*

## How to Run

1. Make sure your virtual environment is activated and dependencies are installed.
2. Start the Flask server:
   ```bash
   python app.py
   ```
3. Open your web browser and navigate to: [http://127.0.0.1:5000](http://127.0.0.1:5000)

## Future Improvements
While this MVP is fully functional, here are some planned features for the future:
- Voice interview functionality (Speech-to-text / Text-to-speech)
- Real-time conversational interview mode using WebSockets
- Support for multiple languages
- Advanced historical analytics and learning roadmaps
- User authentication and cloud deployment
- Dedicated coding interview mode with code execution

## Author
Built as an interactive, beginner-friendly AI learning project.
