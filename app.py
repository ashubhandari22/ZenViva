"""
app.py
Main entry point for the AI Interview Coach application.
This file handles web requests and routes them to the correct pages or logic.
It connects the frontend HTML templates with the backend Python code.
"""
from flask import Flask, render_template, request, session, redirect, url_for, jsonify
import os
import uuid
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from database.database import init_db, save_interview, get_all_interviews, get_interview, delete_interview, clear_all_interviews
from utils.resume_parser import extract_text_from_pdf
from ai.question_generator import generate_questions
from ai.evaluator import evaluate_answer

# Load environment variables from .env file
load_dotenv()

# Initialize the SQLite database
init_db()

# Initialize the Flask application
app = Flask(__name__)
# Secret key is required for Flask sessions (storing data between requests)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "super-secret-default-key")

@app.route('/')
def index():
    """
    Renders the home page (index.html).
    This is the first page users see to start an interview.
    """
    return render_template('index.html')

@app.route('/favicon.ico')
def favicon():
    """
    Serves the modern app logo as the favicon.
    """
    return app.send_static_file('img/logo.png')

@app.route('/setup', methods=['POST'])
def setup_interview():
    """
    Handles the form submission from the home page.
    Stores the selected interview settings in the user's session.
    """
    # Extract data from the submitted form with safe fallbacks
    role = request.form.get('role') or 'Python Developer'
    custom_role = request.form.get('custom_role') or ''
    experience = request.form.get('experience') or 'Junior / Beginner'
    skills = request.form.get('skills') or 'Python, Problem Solving'
    interview_type = request.form.get('interview_type') or 'Technical'
    difficulty = request.form.get('difficulty') or 'Medium'
    num_questions = request.form.get('num_questions', default=5, type=int) or 5

    # Use custom role if 'Custom Role' was selected
    if role == 'Custom Role' and custom_role.strip():
        role = custom_role.strip()

    resume_file_path = ""
    # Handle Resume/Document Upload safely (supports PDF, DOCX, TXT)
    if 'resume' in request.files:
        file = request.files['resume']
        if file and file.filename:
            file_ext = os.path.splitext(file.filename)[1].lower()
            allowed_extensions = {'.pdf', '.docx', '.txt'}
            if file_ext in allowed_extensions:
                upload_dir = os.path.join(os.path.dirname(__file__), 'uploads')
                os.makedirs(upload_dir, exist_ok=True)
                safe_name = secure_filename(file.filename) or f"document{file_ext}"
                unique_filename = f"{uuid.uuid4().hex[:10]}_{safe_name}"
                file_path = os.path.join(upload_dir, unique_filename)
                file.save(file_path)
                # Store file path only to keep Flask cookie under 4KB limit
                resume_file_path = file_path


    # Store settings in session to use them during the interview
    session['interview_config'] = {
        'role': role,
        'experience': experience,
        'skills': skills,
        'interview_type': interview_type,
        'difficulty': difficulty,
        'num_questions': num_questions,
        'resume_file': resume_file_path
    }
    
    # Redirect to the actual interview page
    return redirect(url_for('interview'))

@app.route('/interview')
def interview():
    """
    Renders the interview screen.
    Checks if interview config is in session first.
    """
    if 'interview_config' not in session:
        return redirect(url_for('index'))
    
    return render_template('interview.html', config=session['interview_config'])

@app.route('/api/generate_questions', methods=['POST'])
def api_generate_questions():
    """
    API endpoint to generate questions based on the session config.
    """
    if 'interview_config' not in session:
        return jsonify({"error": "No interview session found"}), 400
        
    config = session['interview_config']
    
    # Safely load resume text from uploaded file if available
    resume_text = ""
    resume_file = config.get('resume_file', '')
    if resume_file and os.path.exists(resume_file):
        try:
            resume_text = extract_text_from_pdf(resume_file)
        except Exception as e:
            print(f"Notice: Could not parse resume file: {e}")

    data = generate_questions(
        role=config['role'],
        experience=config['experience'],
        skills=config['skills'],
        interview_type=config['interview_type'],
        difficulty=config['difficulty'],
        num_questions=config['num_questions'],
        resume_text=resume_text
    )
    
    return jsonify(data)

@app.route('/api/evaluate', methods=['POST'])
def api_evaluate():
    """
    API endpoint to evaluate an answer.
    Expects JSON data with question, answer, topic, and difficulty.
    """
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    question = (data.get('question') or '').strip()
    answer = (data.get('answer') or '').strip()
    if not question or not answer:
        return jsonify({"error": "Question and answer cannot be empty"}), 400

    topic = data.get('topic', 'General')
    difficulty = data.get('difficulty', 'Medium')
    
    config = session.get('interview_config', {})
    role = config.get('role', 'Candidate')
    
    evaluation = evaluate_answer(
        question=question,
        user_answer=answer,
        role=role,
        topic=topic,
        difficulty=difficulty
    )
    
    return jsonify(evaluation)

@app.route('/api/save_interview', methods=['POST'])
def api_save_interview():
    """
    API endpoint to save the final interview results.
    """
    if 'interview_config' not in session:
        return jsonify({"error": "No interview session found"}), 400
        
    data = request.json or {}
    results = data.get('results', [])
    if not results:
        return jsonify({"error": "No interview responses provided to save"}), 400
        
    interview_id = save_interview(session['interview_config'], results)
    
    return jsonify({"success": True, "interview_id": interview_id})

@app.route('/api/delete_interview/<int:interview_id>', methods=['POST'])
def api_delete_interview(interview_id):
    """
    API endpoint to delete a specific interview and its responses.
    """
    success = delete_interview(interview_id)
    return jsonify({"success": success})

@app.route('/api/clear_history', methods=['POST'])
def api_clear_history():
    """
    API endpoint to clear all interview history.
    """
    success = clear_all_interviews()
    return jsonify({"success": success})

@app.route('/cancel_interview', methods=['POST', 'GET'])
def cancel_interview():
    """
    Clears the active interview session and redirects to home.
    """
    session.pop('interview_config', None)
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    """
    Displays the user's past interviews.
    """
    interviews = get_all_interviews()
    return render_template('dashboard.html', interviews=interviews)
    
@app.route('/result/<int:interview_id>')
def result(interview_id):
    """
    Displays the final results and topic breakdown of a specific interview.
    """
    data = get_interview(interview_id)
    if not data:
        return redirect(url_for('dashboard'))
    return render_template('result.html', data=data)

if __name__ == '__main__':
    # Run the application in debug mode on port 5000
    app.run(debug=True, port=5000)

