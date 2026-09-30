"""
database/database.py
Handles all interactions with the SQLite database.
Stores completed interviews and their individual question responses.
"""
import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'interviews.db')

def init_db():
    """
    Initializes the database by creating the necessary tables if they don't exist,
    and runs lightweight migrations for new columns.
    """
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table for storing overall interview session data
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS interviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT,
            experience TEXT,
            skills TEXT,
            interview_type TEXT,
            difficulty TEXT,
            total_questions INTEGER,
            average_score REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table for storing individual questions and answers for each interview
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            interview_id INTEGER,
            question TEXT,
            answer TEXT,
            score REAL,
            feedback TEXT,
            improvement TEXT,
            topic TEXT,
            strengths TEXT DEFAULT '[]',
            missing_points TEXT DEFAULT '[]',
            sample_answer TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (interview_id) REFERENCES interviews (id)
        )
    ''')
    
    # Check and migrate columns if database already existed
    cursor.execute("PRAGMA table_info(responses)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'strengths' not in columns:
        cursor.execute("ALTER TABLE responses ADD COLUMN strengths TEXT DEFAULT '[]'")
    if 'missing_points' not in columns:
        cursor.execute("ALTER TABLE responses ADD COLUMN missing_points TEXT DEFAULT '[]'")
    if 'sample_answer' not in columns:
        cursor.execute("ALTER TABLE responses ADD COLUMN sample_answer TEXT DEFAULT ''")
    if 'evaluation_matrix' not in columns:
        cursor.execute("ALTER TABLE responses ADD COLUMN evaluation_matrix TEXT DEFAULT '{}'")
        
    conn.commit()
    conn.close()

def save_interview(config, results):
    """
    Saves a completed interview and its responses to the database.
    Calculates the average score.
    Returns the ID of the inserted interview.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Calculate average score safely
        valid_scores = []
        for r in results:
            try:
                sc = float(r.get('evaluation', {}).get('score', 0) or 0)
                valid_scores.append(sc)
            except (ValueError, TypeError):
                valid_scores.append(0.0)

        total_score = sum(valid_scores)
        avg_score = total_score / len(results) if len(results) > 0 else 0
        
        # Insert interview record
        cursor.execute('''
            INSERT INTO interviews 
            (role, experience, skills, interview_type, difficulty, total_questions, average_score)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            config.get('role') or 'Software Professional',
            config.get('experience') or 'Junior',
            config.get('skills') or 'Technical Skills',
            config.get('interview_type') or 'Technical',
            config.get('difficulty') or 'Medium',
            len(results),
            round(avg_score, 2)
        ))
        
        interview_id = cursor.lastrowid
        
        # Insert each response
        for r in results:
            question_obj = r.get('question', {})
            eval_data = r.get('evaluation', {})
            
            # Extract question text and topic safely whether question is dict or str
            if isinstance(question_obj, dict):
                q_text = question_obj.get('question', '')
                q_topic = question_obj.get('topic', 'General')
            else:
                q_text = str(question_obj)
                q_topic = 'General'

            raw_strengths = eval_data.get('strengths', [])
            if isinstance(raw_strengths, str):
                raw_strengths = [raw_strengths]
            strengths_json = json.dumps(raw_strengths)

            raw_missing = eval_data.get('missing_points', [])
            if isinstance(raw_missing, str):
                raw_missing = [raw_missing]
            missing_json = json.dumps(raw_missing)

            sample_answer = eval_data.get('sample_answer', '')
            score_val = float(eval_data.get('score', 0) or 0)
            matrix_json = json.dumps(eval_data.get('evaluation_matrix', {}))
            
            cursor.execute('''
                INSERT INTO responses 
                (interview_id, question, answer, score, feedback, improvement, topic, strengths, missing_points, sample_answer, evaluation_matrix)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                interview_id,
                q_text,
                r.get('answer', ''),
                score_val,
                eval_data.get('feedback', ''),
                eval_data.get('improvement', ''),
                q_topic,
                strengths_json,
                missing_json,
                sample_answer,
                matrix_json
            ))
            
        conn.commit()
        return interview_id
    finally:
        conn.close()

def get_all_interviews():
    """
    Retrieves all interviews for the dashboard, ordered by newest first.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Returns rows as dictionaries
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM interviews ORDER BY created_at DESC')
        rows = cursor.fetchall()
        
        interviews = []
        for row in rows:
            item = dict(row)
            item['average_score'] = float(item.get('average_score') or 0.0)
            item['total_questions'] = int(item.get('total_questions') or 0)
            item['role'] = item.get('role') or 'Software Professional'
            item['difficulty'] = item.get('difficulty') or 'Medium'
            item['interview_type'] = item.get('interview_type') or 'Technical'
            item['experience'] = item.get('experience') or 'Junior'
            interviews.append(item)
        return interviews
    finally:
        conn.close()
    
def get_interview(interview_id):
    """
    Retrieves a specific interview and its responses with decoded strengths and missing points.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM interviews WHERE id = ?', (interview_id,))
        interview = cursor.fetchone()
        
        if not interview:
            return None
            
        cursor.execute('SELECT * FROM responses WHERE interview_id = ? ORDER BY id ASC', (interview_id,))
        responses = cursor.fetchall()
        
        interview_dict = dict(interview)
        interview_dict['average_score'] = float(interview_dict.get('average_score') or 0.0)
        interview_dict['total_questions'] = int(interview_dict.get('total_questions') or 0)
        interview_dict['role'] = interview_dict.get('role') or 'Candidate'
        interview_dict['experience'] = interview_dict.get('experience') or 'Standard'
        interview_dict['interview_type'] = interview_dict.get('interview_type') or 'Technical'
        
        formatted_responses = []
        for r in responses:
            resp_dict = dict(r)
            # Parse JSON fields safely and ensure always list of strings
            try:
                val = json.loads(resp_dict.get('strengths') or '[]')
                if isinstance(val, str):
                    resp_dict['strengths'] = [val]
                elif isinstance(val, list):
                    resp_dict['strengths'] = val
                else:
                    resp_dict['strengths'] = []
            except Exception:
                resp_dict['strengths'] = []
                
            try:
                val = json.loads(resp_dict.get('missing_points') or '[]')
                if isinstance(val, str):
                    resp_dict['missing_points'] = [val]
                elif isinstance(val, list):
                    resp_dict['missing_points'] = val
                else:
                    resp_dict['missing_points'] = []
            except Exception:
                resp_dict['missing_points'] = []
                
            try:
                val = json.loads(resp_dict.get('evaluation_matrix') or '{}')
                resp_dict['evaluation_matrix'] = val if isinstance(val, dict) else {}
            except Exception:
                resp_dict['evaluation_matrix'] = {}
                
            formatted_responses.append(resp_dict)
        
        return {
            "interview": interview_dict,
            "responses": formatted_responses
        }
    finally:
        conn.close()

def delete_interview(interview_id):
    """
    Deletes an interview and all associated question responses.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM responses WHERE interview_id = ?', (interview_id,))
    cursor.execute('DELETE FROM interviews WHERE id = ?', (interview_id,))
    conn.commit()
    conn.close()
    return True

def clear_all_interviews():
    """
    Clears all interviews and responses from the database.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM responses')
    cursor.execute('DELETE FROM interviews')
    conn.commit()
    conn.close()
    return True

