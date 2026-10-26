"""
Built-in example diffs, so anyone opening the website can try it in two clicks,
plus pre-written "demo" reviews used only when no API key is available
(handy as an offline backup during a presentation).

Each demo has one roast per reviewer, so demo mode still reacts to who you pick.
"""

from core import ReviewReport

SAMPLES = {
    "leak": {
        "label": "Leaked password",
        "icon": "lock",
        "diff": """diff --git a/auth.py b/auth.py
index 1234567..89abcde 100644
--- a/auth.py
+++ b/auth.py
@@ -10,4 +10,8 @@ def login_user(username, password):
-    query = "SELECT * FROM users WHERE username = %s"
-    cursor.execute(query, (username,))
+    # Quick fix for demo tomorrow!!
+    ADMIN_PASS = "supersecret123"
+    if password == ADMIN_PASS:
+        return True
+    query = f"SELECT * FROM users WHERE username = '{username}' AND pass = '{password}'"
+    cursor.execute(query)
     return cursor.fetchone()""",
    },
    "test": {
        "label": "Deleted test",
        "icon": "flask",
        "diff": """diff --git a/tests/test_payment.py b/tests/test_payment.py
index 4e5f6a7..8b9c0d1 100644
--- a/tests/test_payment.py
+++ b/tests/test_payment.py
@@ -15,7 +15,3 @@ def test_charge_credit_card():
-    response = charge_card(amount=500, currency="USD")
-    assert response.status == "SUCCESS"
-    assert db.get_balance() == 500
+    # TODO: fix later, failing on CI
+    assert True == True""",
    },
    "clean": {
        "label": "Clean fix",
        "icon": "check",
        "diff": """diff --git a/utils/dates.py b/utils/dates.py
index 2a3b4c5..6d7e8f9 100644
--- a/utils/dates.py
+++ b/utils/dates.py
@@ -1,6 +1,10 @@
-from datetime import datetime
+from datetime import datetime, timezone


 def now_iso():
-    return datetime.now().isoformat()
+    \"\"\"Current time as an ISO-8601 string, always in UTC.\"\"\"
+    return datetime.now(timezone.utc).isoformat()
diff --git a/tests/test_dates.py b/tests/test_dates.py
new file mode 100644
--- /dev/null
+++ b/tests/test_dates.py
@@ -0,0 +1,5 @@
+from utils.dates import now_iso
+
+
+def test_now_iso_is_utc():
+    assert now_iso().endswith("+00:00")""",
    },
}

# The facts are the same whoever reviews; only the roast changes voice.
_DEMO_FACTS = {
    "leak": dict(
        summary="The login function now accepts a hardcoded admin password that bypasses the database entirely. It also builds the SQL query by pasting user input straight into the string instead of passing it as a parameter.",
        risk_score=10,
        concerns=[
            "SQL injection: username and password are inserted with an f-string, so a username like ' OR '1'='1 logs anyone in.",
            "The hardcoded password 'supersecret123' is now in source control and unlocks every account.",
            "Passwords are compared as plain text, which suggests they are stored unhashed.",
        ],
        conventional_commit="fix(auth): restore parameterised login query",
    ),
    "test": dict(
        summary="The credit-card test no longer charges a card or checks the result. It now always passes, so the payment code is effectively untested.",
        risk_score=8,
        concerns=[
            "The payment flow has lost its only automated check, so a broken charge_card() would ship silently.",
            "The CI failure is hidden rather than fixed; mark the test with pytest.mark.xfail and open a ticket instead.",
            "'assert True == True' misleads future readers into thinking the test means something.",
        ],
        conventional_commit="test(payment): disable failing card charge test",
    ),
    "clean": dict(
        summary="now_iso() now returns the current time in UTC instead of the server's local time. A new test checks the output carries the +00:00 UTC offset.",
        risk_score=2,
        concerns=[
            "Callers that relied on local time will now get UTC, so check anywhere this value is shown to users.",
        ],
        conventional_commit="fix(dates): return timezone-aware utc timestamps",
    ),
}

_DEMO_ROASTS = {
    "leak": {
        "staff": "Ah, I see we've replaced a perfectly safe parameterised query with an f-string and a password in plain text. Bold. Per my last review, 'demo tomorrow' is not a security model, and 'supersecret123' is now neither super nor secret.",
        "pirate": "Arr, ye've carved the treasure password right onto the mast for every scallywag to read! And that f-string lets any landlubber stroll aboard with ' OR '1'='1. Walk the plank, ye bilge-brained deckhand.",
        "chef": "What is THIS? You took a perfectly seasoned parameterised query and stuffed raw user input straight into it! And the password is written on the menu for the whole restaurant! This login is RAW. Get it off my pass!",
        "sre": "Cool. So at 3:12 AM the database gets dumped, I get paged, and the incident report just says 'demo tomorrow!!'. Hardcoded admin password plus string-built SQL. I'm going to start writing the postmortem now.",
        "genz": "bestie hardcoded 'supersecret123' and called it security. the f-string SQL is giving open house for hackers. no cap this commit is a data breach speedrun.",
        "auditor": "Two critical findings in eight lines. A static admin credential grants universal access, and unsanitised input reaches the SQL engine. An attacker doesn't need to hack this login. They can simply walk in.",
    },
    "test": {
        "staff": "Interesting approach: the test was failing, so we taught it to stop asking questions. 'assert True == True'. Just curious, did we also unplug the smoke detector because it kept beeping?",
        "pirate": "Ye threw the lookout overboard 'cause he kept shoutin' 'rocks ahead!' Now 'assert True == True' sits in the crow's nest, blind as a barnacle, while the payment ship sails straight for the reef.",
        "chef": "The taster said the dish was burnt, so you fired the taster? 'assert True == True' isn't a test, it's an empty plate with a garnish on it! Unbelievable. Absolutely unbelievable.",
        "sre": "Ah, the classic. CI was red, so now CI is green and payments are a mystery box. When charge_card breaks in production I'll know exactly whose TODO to blame. It's this one. It's yours.",
        "genz": "the test was failing so u just... deleted the vibes? 'assert True == True' is lowkey the most delulu line i've seen all week. CI passing but make it fake.",
        "auditor": "Removing the only check on the payment path creates an undetected-failure risk. A tautological assertion gives false assurance to anyone reading the coverage report. This is how billing errors go unnoticed for months.",
    },
    "clean": {
        "staff": "A timezone-aware timestamp, a docstring AND a test? I came here to roast and you've handed me a salad. Per my last review, I have nothing to complain about, and I find that deeply unsettling.",
        "pirate": "Shiver me timbers, a UTC timestamp AND a test to guard it? I came to plunder and found the ship shipshape. I'll stow me cutlass for now, but I'm watchin' ye.",
        "chef": "Finally! Someone in this kitchen who seasons the dish properly. UTC, a docstring and a test. Beautiful. I'm almost disappointed. Almost.",
        "sre": "UTC timestamps and a test. You have no idea what this means to me. I might actually sleep tonight. Ship it before something ruins it.",
        "genz": "ok wait this is actually clean?? UTC, docstring, test. it's giving senior dev energy. i have nothing. respectfully, slay.",
        "auditor": "Timezone-aware times remove a whole class of log-correlation bugs, and the change is covered by a test. No exploitable issues found. I remain suspicious on principle.",
    },
}


def match_sample(diff: str):
    """Returns the sample id if the text is exactly one of the built-in examples."""
    clean = diff.strip()
    return next((sid for sid, s in SAMPLES.items() if s["diff"].strip() == clean), None)


def demo_report(sample_id: str, persona_id: str) -> ReviewReport:
    return ReviewReport(roast=_DEMO_ROASTS[sample_id][persona_id], **_DEMO_FACTS[sample_id])
