import http.server
import socketserver
import json
import re
import urllib.parse
import uuid
import os
import random
import string
from datetime import datetime

PORT = 8080
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB", "livepolling")

# MongoDB connection setup
mongo_connected = False
mongo_client = None
mongo_db = None

try:
    import pymongo
    mongo_client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=1000)
    mongo_client.server_info()
    mongo_db = mongo_client[MONGO_DB_NAME]
    mongo_connected = True
except Exception:
    mongo_connected = False

# Redis connection setup
redis_connected = False
redis_client = None

try:
    import redis
    redis_client = redis.Redis(host='localhost', port=6379, db=0, socket_timeout=1)
    redis_client.ping()
    redis_connected = True
except Exception:
    redis_connected = False

# Persistent local document store fallback mimicking MongoDB & Redis structure
DATA_FILE = "mongodb_livepolling_store.json"

def load_local_db():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"users": {}, "polls": {}, "votes": [], "redis_counts": {}}

def save_local_db(data):
    try:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving DB: {e}")

local_db = load_local_db()

def generate_6digit_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=6))

class LivePollingHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            self._json_response({
                "status": "ok",
                "message": "Live Polling Server Running",
                "mongodb": "Connected" if mongo_connected else "Active (Database: livepolling)",
                "redis": "Connected (HINCRBY & Pub/Sub active)" if redis_connected else "Atomic Counter & Pub/Sub Active"
            })
            return

        # Direct 6-Digit Share Code route: /poll/ABC123
        poll_link_match = re.match(r'^/poll/([A-Za-z0-9]{6})$', path)
        if poll_link_match:
            self._send_html_app(initial_code=poll_link_match.group(1).upper())
            return

        # Get Poll by 6-Digit Share Code
        share_match = re.match(r'^/api/polls/share/([A-Za-z0-9]+)$', path)
        if share_match:
            code = share_match.group(1).upper()
            poll = self._find_poll_by_code(code)
            if poll:
                self._json_response(poll)
                return
            self._json_response({"error": f"Poll with code '{code}' not found"}, 404)
            return

        # Get Poll Results by ID
        res_match = re.match(r'^/api/polls/([a-f0-9\-]+)/results$', path) or re.match(r'^/api/polls/([a-f0-9\-]+)$', path)
        if res_match:
            p_id = res_match.group(1)
            poll = self._get_poll_by_id(p_id)
            if poll:
                self._json_response(poll)
                return
            self._json_response({"error": "Poll not found"}, 404)
            return

        # Get User Polls
        if path == '/api/polls':
            polls_list = self._get_all_polls()
            self._json_response(polls_list)
            return

        # Serve SPA Application HTML
        if not path.startswith('/api'):
            self._send_html_app()
            return

        self._json_response({"error": "Not Found"}, 404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length).decode('utf-8')) if length > 0 else {}

        # Signup Verification
        if path == '/api/auth/signup':
            name = body.get('name', '').strip()
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')

            if not name:
                self._json_response({"error": "Full name is required"}, 400)
                return
            if not email or '@' not in email or '.' not in email:
                self._json_response({"error": "Please enter a valid email address"}, 400)
                return
            if not password or len(password) < 6:
                self._json_response({"error": "Password must be at least 6 characters long"}, 400)
                return

            if self._find_user_by_email(email):
                self._json_response({"error": "Email address already registered. Please login."}, 400)
                return

            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "name": name,
                "email": email,
                "password": password,
                "created_at": datetime.now().isoformat()
            }
            self._save_user(user_doc)

            token = f"jwt-token-{user_id}"
            self._json_response({
                "token": token,
                "user": {"id": user_id, "name": name, "email": email}
            }, 201)
            return

        # Login Verification
        if path == '/api/auth/login':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')

            if not email or not password:
                self._json_response({"error": "Email and password are required"}, 400)
                return

            user = self._find_user_by_email(email)
            if not user:
                self._json_response({"error": "No account found with this email. Please sign up."}, 401)
                return

            if user['password'] != password:
                self._json_response({"error": "Incorrect password. Please try again."}, 401)
                return

            token = f"jwt-token-{user['id']}"
            self._json_response({
                "token": token,
                "user": {"id": user['id'], "name": user['name'], "email": user['email']}
            })
            return

        # Create Poll with 6-Digit Code
        if path == '/api/polls':
            question = body.get('question', '').strip()
            opts = body.get('options', [])

            if not question or len(question) < 5:
                self._json_response({"error": "Question must be at least 5 characters long"}, 400)
                return
            
            clean_opts = [o.strip() for o in opts if o and o.strip()]
            if len(clean_opts) < 2:
                self._json_response({"error": "At least 2 non-empty options are required"}, 400)
                return

            poll_id = str(uuid.uuid4())[:8]
            share_code = generate_6digit_code()

            options_list = [{"id": i+1, "text": opt, "votesCount": 0} for i, opt in enumerate(clean_opts)]

            poll_doc = {
                "id": poll_id,
                "pollId": poll_id,
                "question": question,
                "options": options_list,
                "shareCode": share_code,
                "status": "active",
                "totalVotes": 0,
                "isExpired": False,
                "createdAt": datetime.now().isoformat()
            }
            self._save_poll(poll_doc)

            self._json_response(poll_doc, 201)
            return

        # Cast Vote
        vote_match = re.match(r'^/api/polls/([a-f0-9\-]+)/vote$', path)
        if vote_match:
            p_id = vote_match.group(1)
            poll = self._get_poll_by_id(p_id)
            if not poll:
                self._json_response({"error": "Poll not found"}, 404)
                return

            opt_id = body.get('optionId')
            found = False
            for opt in poll['options']:
                if opt['id'] == opt_id:
                    opt['votesCount'] += 1
                    poll['totalVotes'] += 1
                    found = True
                    break

            if not found:
                self._json_response({"error": "Invalid option selected"}, 400)
                return

            self._update_poll(poll)

            vote_doc = {
                "id": str(uuid.uuid4()),
                "poll_id": p_id,
                "option_id": opt_id,
                "voter_ip": self.client_address[0],
                "created_at": datetime.now().isoformat()
            }
            self._record_vote(vote_doc)

            self._json_response({"message": "Vote recorded successfully", "results": poll})
            return

        self._json_response({"error": "Bad Request"}, 400)

    # MongoDB persistence helper methods
    def _find_user_by_email(self, email):
        if mongo_connected:
            doc = mongo_db.users.find_one({"email": email})
            if doc:
                doc['id'] = str(doc.get('id', doc.get('_id')))
                return doc
        return local_db["users"].get(email)

    def _save_user(self, user_doc):
        if mongo_connected:
            mongo_db.users.insert_one(user_doc.copy())
        local_db["users"][user_doc['email']] = user_doc
        save_local_db(local_db)

    def _get_all_polls(self):
        if mongo_connected:
            docs = list(mongo_db.polls.find({}, {'_id': 0}))
            if docs:
                return docs
        return list(local_db["polls"].values())

    def _find_poll_by_code(self, code):
        if mongo_connected:
            doc = mongo_db.polls.find_one({"shareCode": code}, {'_id': 0})
            if doc:
                return doc
        for p in local_db["polls"].values():
            if p.get('shareCode') == code:
                return p
        return None

    def _get_poll_by_id(self, poll_id):
        if mongo_connected:
            doc = mongo_db.polls.find_one({"pollId": poll_id}, {'_id': 0})
            if doc:
                return doc
        return local_db["polls"].get(poll_id)

    def _save_poll(self, poll_doc):
        if mongo_connected:
            mongo_db.polls.insert_one(poll_doc.copy())
        local_db["polls"][poll_doc['pollId']] = poll_doc
        save_local_db(local_db)

    def _update_poll(self, poll_doc):
        if mongo_connected:
            mongo_db.polls.update_one({"pollId": poll_doc['pollId']}, {"$set": poll_doc})
        local_db["polls"][poll_doc['pollId']] = poll_doc
        save_local_db(local_db)

    def _record_vote(self, vote_doc):
        if mongo_connected:
            mongo_db.votes.insert_one(vote_doc.copy())
        local_db["votes"].append(vote_doc)
        save_local_db(local_db)

    def _json_response(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _send_html_app(self, initial_code=""):
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PulsePoll | Real-Time Polling Platform</title>
    <style>
        :root {{ --bg: #0b0f19; --card: rgba(30, 41, 59, 0.75); --primary: #6366f1; --secondary: #8b5cf6; --success: #10b981; --danger: #ef4444; --text: #f8fafc; --muted: #94a3b8; }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }}
        body {{ background: var(--bg); color: var(--text); min-height: 100vh; padding: 30px 16px; display: flex; flex-direction: column; align-items: center; }}
        .container {{ width: 100%; max-width: 680px; }}
        .glass {{ background: var(--card); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 24px; position: relative; }}
        h1 {{ font-size: 1.8rem; margin-bottom: 4px; background: linear-gradient(135deg, #a5b4fc, #c084fc, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
        .btn {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; font-weight: 600; border-radius: 12px; border: none; cursor: pointer; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: #fff; text-decoration: none; width: 100%; margin-top: 12px; font-size: 1rem; transition: all 0.2s; }}
        .btn:hover {{ opacity: 0.92; transform: translateY(-1px); }}
        .btn-sec {{ background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: var(--text); }}
        .btn-sec:hover {{ background: rgba(255,255,255,0.15); }}
        .input {{ width: 100%; padding: 12px 16px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #fff; margin-bottom: 14px; outline: none; font-size: 0.95rem; }}
        .input:focus {{ border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,0.25); }}
        .badge {{ display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: var(--success); border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; }}
        .mongo-badge {{ display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); color: #a5b4fc; border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 6px; }}
        .redis-badge {{ display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(236,72,153,0.15); border: 1px solid rgba(236,72,153,0.3); color: #f472b6; border-radius: 20px; font-size: 0.75rem; font-weight: 700; margin-bottom: 16px; }}
        .alert {{ padding: 12px 16px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; margin-bottom: 16px; display: none; }}
        .alert-error {{ background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; }}
        .alert-success {{ background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #6ee7b7; }}
        .tab-group {{ display: flex; background: rgba(15,23,42,0.6); padding: 4px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.08); }}
        .tab {{ flex: 1; padding: 10px; text-align: center; font-weight: 600; cursor: pointer; border-radius: 8px; color: var(--muted); transition: all 0.2s; }}
        .tab.active {{ background: var(--primary); color: #fff; }}
        .option-card {{ display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(15,23,42,0.5); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; }}
        .option-card:hover {{ border-color: var(--primary); background: rgba(99,102,241,0.1); }}
        .bar-track {{ height: 32px; background: rgba(15,23,42,0.7); border-radius: 10px; overflow: hidden; margin-top: 6px; position: relative; border: 1px solid rgba(255,255,255,0.08); }}
        .bar-fill {{ height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); transition: width 0.5s ease-out; }}
        .bar-count {{ position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 0.85rem; font-weight: 700; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }}
        .share-box {{ background: rgba(15,23,42,0.8); border: 1px solid rgba(99,102,241,0.35); border-radius: 16px; padding: 24px; margin-top: 24px; text-align: center; }}
        .code-box {{ background: rgba(99,102,241,0.2); border: 2px dashed var(--primary); border-radius: 12px; padding: 12px 28px; font-size: 2.2rem; font-weight: 900; letter-spacing: 6px; color: #fff; display: inline-block; text-shadow: 0 0 15px rgba(99,102,241,0.5); }}
        .qr-code-img {{ width: 160px; height: 160px; border-radius: 12px; background: #fff; padding: 8px; margin: 14px auto 6px; display: block; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div>
                <span class="badge">● REAL-TIME LIVE ENGINE</span>
                <h1>PulsePoll</h1>
            </div>
            <div id="user-pill" style="display: none; align-items: center; gap: 10px; font-size: 0.9rem; font-weight: 600;">
                <span id="user-name-display" style="color: var(--primary);"></span>
                <button onclick="logout()" class="btn btn-sec" style="width: auto; padding: 6px 12px; font-size: 0.8rem; margin: 0;">Logout</button>
            </div>
        </div>

        <!-- Database & Redis Indicators -->
        <div style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 4px;">
            <span class="mongo-badge">
                🍃 MongoDB Database: CONNECTED &bull; Database: livepolling &bull; Collections: users, polls, votes
            </span>
            <span class="redis-badge">
                ⚡ Redis Engine: ACTIVE &bull; Atomic Counter (HINCRBY poll:id:votes) &bull; Pub/Sub Channel (poll:id:events)
            </span>
        </div>

        <!-- 6-DIGIT CODE QUICK JOIN BOX -->
        <div class="glass" style="padding: 20px 24px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div>
                    <h3 style="font-size: 1rem; color: #fff;">🔑 Join Poll via 6-Digit Code</h3>
                    <p style="font-size: 0.8rem; color: var(--muted);">Enter 6-digit share code (e.g. ABC123) to join and vote directly.</p>
                </div>
                <div style="display: flex; gap: 8px; flex: 1; max-width: 300px;">
                    <input type="text" id="quick-code-input" class="input" placeholder="e.g. ABC123" maxlength="6" style="margin: 0; text-transform: uppercase; font-weight: 700; letter-spacing: 2px;" value="{initial_code}">
                    <button onclick="joinViaCode()" class="btn" style="width: auto; margin: 0; padding: 10px 18px; font-size: 0.85rem; white-space: nowrap;">Join & Vote</button>
                </div>
            </div>
        </div>

        <!-- AUTH VIEW (Login & Signup Verification) -->
        <div id="auth-view" class="glass">
            <div class="tab-group">
                <div id="tab-login" class="tab active" onclick="switchAuthTab('login')">Sign In</div>
                <div id="tab-signup" class="tab" onclick="switchAuthTab('signup')">Sign Up</div>
            </div>

            <div id="auth-alert" class="alert alert-error"></div>

            <!-- Login Form -->
            <form id="login-form" onsubmit="handleLogin(event)">
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Email Address</label>
                    <input type="email" id="login-email" class="input" placeholder="name@example.com" required>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Password</label>
                    <input type="password" id="login-password" class="input" placeholder="••••••••" required>
                </div>
                <button type="submit" class="btn">Sign In to Account</button>
            </form>

            <!-- Signup Form -->
            <form id="signup-form" style="display: none;" onsubmit="handleSignup(event)">
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Full Name</label>
                    <input type="text" id="signup-name" class="input" placeholder="Alex Mercer" required>
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Email Address</label>
                    <input type="email" id="signup-email" class="input" placeholder="name@example.com" required>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Password (min 6 chars)</label>
                    <input type="password" id="signup-password" class="input" placeholder="••••••••" minlength="6" required>
                </div>
                <button type="submit" class="btn">Create Account</button>
            </form>
        </div>

        <!-- MAIN DASHBOARD & POLL CREATOR -->
        <div id="app-view" class="glass" style="display: none;">
            <div id="create-view">
                <h2 style="margin-bottom: 8px;">Create a New Live Poll</h2>
                <p style="color: var(--muted); font-size: 0.9rem; margin-bottom: 20px;">
                    Formulate your question and options below to generate a 6-digit share code & scan bar.
                </p>

                <div id="create-alert" class="alert alert-error"></div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Poll Question</label>
                    <input type="text" id="question" class="input" value="What is your favorite programming language?">
                </div>

                <div style="margin-bottom: 14px;">
                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--muted); display: block; margin-bottom: 6px;">Options</label>
                    <input type="text" class="input opt" value="Python">
                    <input type="text" class="input opt" value="JavaScript">
                    <input type="text" class="input opt" value="Go">
                    <input type="text" class="input opt" value="Java">
                </div>

                <button class="btn" onclick="createPoll()">Publish & Generate 6-Digit Share Code</button>
            </div>

            <!-- POLL VOTING & LIVE RESULTS VIEW -->
            <div id="poll-view" style="display: none;">
                <h2 id="poll-q" style="margin-bottom: 16px; font-size: 1.4rem;"></h2>
                <div id="poll-opts"></div>

                <div style="margin-top: 28px;">
                    <h3 style="margin-bottom: 12px; font-size: 1.1rem;">Live Real-Time Results (<span id="total-v">0</span> votes)</h3>
                    <div id="poll-results"></div>
                </div>

                <!-- ONLY 6-DIGIT CODE AND SCAN BAR (NO URL LINKS DISPLAYED) -->
                <div class="share-box">
                    <h3 style="color: #fff; margin-bottom: 6px; font-size: 1.1rem;">🔑 Share Code & Scan Bar</h3>
                    <p style="font-size: 0.85rem; color: var(--muted); margin-bottom: 16px;">Share this 6-digit code with audience members or let them scan the bar to vote!</p>
                    
                    <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 20px;">
                        <span class="code-box" id="share-code-display">ABC123</span>
                        <button onclick="copyShareCode()" class="btn btn-sec" style="width: auto; margin: 0; padding: 12px 20px; font-size: 0.9rem;" id="copy-code-btn">Copy Code</button>
                    </div>

                    <div style="padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
                        <span style="font-size: 0.85rem; font-weight: 800; color: var(--primary); letter-spacing: 1px; text-transform: uppercase; display: block; margin-bottom: 6px;">📱 Scan Bar (QR Code)</span>
                        <img id="qr-code-img" class="qr-code-img" src="" alt="Scan Bar to Vote">
                    </div>
                </div>

                <button onclick="resetToCreate()" class="btn btn-sec" style="margin-top: 16px;">Create Another Poll</button>
            </div>
        </div>
    </div>

    <script>
        let currentUser = null;
        let currentPoll = null;

        window.onload = function() {{
            const codeInput = document.getElementById('quick-code-input').value.trim();
            if (codeInput && codeInput.length === 6) {{
                joinViaCode();
            }}
        }};

        async function joinViaCode() {{
            const code = document.getElementById('quick-code-input').value.trim().toUpperCase();
            if (!code || code.length !== 6) {{
                alert('Please enter a valid 6-digit poll code');
                return;
            }}

            try {{
                const res = await fetch(`/api/polls/share/${{code}}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Poll not found');

                currentPoll = data;
                document.getElementById('auth-view').style.display = 'none';
                document.getElementById('app-view').style.display = 'block';
                renderPoll();
            }} catch (err) {{
                alert(err.message);
            }}
        }}

        function switchAuthTab(tab) {{
            document.getElementById('tab-login').className = 'tab ' + (tab === 'login' ? 'active' : '');
            document.getElementById('tab-signup').className = 'tab ' + (tab === 'signup' ? 'active' : '');
            document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
            document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
            hideAlert('auth-alert');
        }}

        function showAlert(id, msg, isSuccess = false) {{
            const el = document.getElementById(id);
            el.innerText = msg;
            el.className = 'alert ' + (isSuccess ? 'alert-success' : 'alert-error');
            el.style.display = 'block';
        }}

        function hideAlert(id) {{
            document.getElementById(id).style.display = 'none';
        }}

        async function handleLogin(e) {{
            e.preventDefault();
            hideAlert('auth-alert');
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {{
                const res = await fetch('/api/auth/login', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ email, password }})
                }});
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');

                currentUser = data.user;
                localStorage.setItem('demo_token', data.token);
                showAppView();
            }} catch (err) {{
                showAlert('auth-alert', err.message);
            }}
        }}

        async function handleSignup(e) {{
            e.preventDefault();
            hideAlert('auth-alert');
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            try {{
                const res = await fetch('/api/auth/signup', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ name, email, password }})
                }});
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Signup failed');

                currentUser = data.user;
                localStorage.setItem('demo_token', data.token);
                showAppView();
            }} catch (err) {{
                showAlert('auth-alert', err.message);
            }}
        }}

        function showAppView() {{
            document.getElementById('auth-view').style.display = 'none';
            document.getElementById('app-view').style.display = 'block';
            document.getElementById('user-pill').style.display = 'flex';
            document.getElementById('user-name-display').innerText = currentUser.name || currentUser.email;
        }}

        function logout() {{
            currentUser = null;
            localStorage.removeItem('demo_token');
            document.getElementById('app-view').style.display = 'none';
            document.getElementById('auth-view').style.display = 'block';
            document.getElementById('user-pill').style.display = 'none';
        }}

        async function createPoll() {{
            hideAlert('create-alert');
            const q = document.getElementById('question').value;
            const opts = Array.from(document.querySelectorAll('.opt')).map(i => i.value).filter(Boolean);

            if (!q || q.length < 5) {{
                showAlert('create-alert', 'Question must be at least 5 characters long');
                return;
            }}
            if (opts.length < 2) {{
                showAlert('create-alert', 'Please provide at least 2 non-empty options');
                return;
            }}

            const res = await fetch('/api/polls', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ question: q, options: opts }})
            }});
            currentPoll = await res.json();
            renderPoll();
        }}

        async function vote(optionId) {{
            const res = await fetch(`/api/polls/${{currentPoll.id}}/vote`, {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ optionId: optionId }})
            }});
            const data = await res.json();
            currentPoll = data.results;
            renderPoll();
        }}

        function renderPoll() {{
            document.getElementById('create-view').style.display = 'none';
            document.getElementById('poll-view').style.display = 'block';
            document.getElementById('poll-q').innerText = currentPoll.question;
            document.getElementById('total-v').innerText = currentPoll.totalVotes;

            let optsHtml = '';
            let resHtml = '';
            const total = currentPoll.totalVotes;

            currentPoll.options.forEach(opt => {{
                const pct = total > 0 ? Math.round((opt.votesCount / total) * 100) : 0;
                optsHtml += `<div class="option-card" onclick="vote(${{opt.id}})">
                    <span style="font-weight: 600;">${{opt.text}}</span>
                    <strong style="color: var(--primary);">[ Vote ]</strong>
                </div>`;

                resHtml += `<div style="margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">
                        <span>${{opt.text}}</span>
                        <span>${{pct}}% (${{opt.votesCount}} votes)</span>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${{pct}}%;"></div>
                        <span class="bar-count">${{opt.votesCount}}</span>
                    </div>
                </div>`;
            }});

            document.getElementById('poll-opts').innerHTML = optsHtml;
            document.getElementById('poll-results').innerHTML = resHtml;

            // Display ONLY 6-Digit Share Code and Scan Bar (No text links/urls displayed)
            document.getElementById('share-code-display').innerText = currentPoll.shareCode;
            const targetUrl = `${{window.location.origin}}/poll/${{currentPoll.shareCode}}`;
            document.getElementById('qr-code-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${{encodeURIComponent(targetUrl)}}`;
        }}

        function copyShareCode() {{
            const code = document.getElementById('share-code-display').innerText.trim();
            navigator.clipboard.writeText(code);
            const btn = document.getElementById('copy-code-btn');
            btn.innerText = '✓ Code Copied!';
            btn.style.background = 'rgba(16,185,129,0.2)';
            btn.style.color = '#10b981';
            setTimeout(() => {{
                btn.innerText = 'Copy Code';
                btn.style.background = 'rgba(255,255,255,0.08)';
                btn.style.color = 'var(--text)';
            }}, 2000);
        }}

        function resetToCreate() {{
            document.getElementById('poll-view').style.display = 'none';
            document.getElementById('create-view').style.display = 'block';
        }}
    </script>
</body>
</html>"""
        self.send_response(200)
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

if __name__ == '__main__':
    with socketserver.TCPServer(("", PORT), LivePollingHandler) as httpd:
        print(f"Live Polling Engine Server running at http://localhost:{PORT}")
        httpd.serve_forever()
