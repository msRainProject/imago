from playwright.sync_api import sync_playwright
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 1280, 'height': 800},
        # Simulate logged-in state by setting localStorage
        storage_state=None
    )
    page = context.new_page()
    
    # Collect console errors
    errors = []
    page.on("console", lambda msg: errors.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: errors.append(f"[PAGE_ERROR] {err}"))
    
    # First login
    page.goto('http://10.39.11.67:8090/login', wait_until='networkidle')
    page.wait_for_timeout(1000)
    
    # Fill login form and submit
    page.fill('input[type="text"], input[name="username"], input[placeholder*="用户"]', 'admin')
    page.fill('input[type="password"], input[name="password"]', 'admin123')
    page.click('button[type="submit"], button:has-text("登录"), button:has-text("登陆")')
    page.wait_for_timeout(2000)
    
    # Navigate to admin passkey tab
    page.goto('http://10.39.11.67:8090/admin?tab=passkey', wait_until='networkidle')
    page.wait_for_timeout(3000)
    
    # Screenshot
    page.screenshot(path='/tmp/passkey_page.png', full_page=True)
    
    # Get page text
    text = page.inner_text('body')
    
    print("=== ERRORS ===")
    for e in errors:
        print(e)
    print("=== PAGE TEXT ===")
    print(text[:2000])
    
    browser.close()
