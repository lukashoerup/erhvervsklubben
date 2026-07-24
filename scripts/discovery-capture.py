#!/usr/bin/env python3
"""Log into the live Erhvervsklub Lovable app, screenshot the main screens, and
capture the Supabase traffic so we can recover the real backend + data model.

Credentials come from env (EMAIL, PASSWORD) — never hardcoded, never written to
disk. Run:  EMAIL=... PASSWORD=... .venv/bin/python review.py
"""
import os
import re
import json
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

URL = "https://kobenhavn-forum-connect.lovable.app/"
EMAIL = os.environ["EMAIL"]
PASSWORD = os.environ["PASSWORD"]
SHOTS = Path(__file__).parent / "shots"
SHOTS.mkdir(exist_ok=True)

# What the app talks to. Supabase REST paths look like /rest/v1/<table>, so the
# set of distinct tables the app touches IS the working data model.
backends: set[str] = set()
rest_tables: set[str] = set()
rpc_calls: set[str] = set()
routes_seen: list[str] = []


def on_request(req):
    u = req.url
    host = urlparse(u).netloc
    if "supabase" in host or ".supabase.co" in u:
        backends.add(host)
        m = re.search(r"/rest/v1/([A-Za-z0-9_]+)", u)
        if m:
            rest_tables.add(m.group(1))
        r = re.search(r"/rest/v1/rpc/([A-Za-z0-9_]+)", u)
        if r:
            rpc_calls.add(r.group(1))


def shoot(page, name):
    page.wait_for_timeout(1500)
    path = SHOTS / f"{name}.png"
    page.screenshot(path=str(path), full_page=True)
    routes_seen.append(f"{name}: {page.url}")
    print(f"  shot {name} -> {page.url}")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 900},
                                  device_scale_factor=1)
        page = ctx.new_page()
        page.on("request", on_request)

        print("landing (logged out)…")
        page.goto(URL, wait_until="networkidle", timeout=45000)
        shoot(page, "01-landing")

        # Also capture a mobile view of the landing page — mobile-friendliness is
        # the whole point of the rebuild, so record the current state.
        mob = ctx.new_page()
        mob.set_viewport_size({"width": 390, "height": 844})
        mob.goto(URL, wait_until="networkidle", timeout=45000)
        mob.wait_for_timeout(1500)
        mob.screenshot(path=str(SHOTS / "01b-landing-mobile.png"), full_page=True)
        mob.close()
        print("  shot 01b-landing-mobile")

        print("logging in…")
        # Lovable auth pages vary; try common shapes without assuming one.
        for sel in ["text=Log ind", "text=Login", "text=Sign in", "text=Log in"]:
            try:
                if page.locator(sel).first.is_visible(timeout=1500):
                    page.locator(sel).first.click()
                    page.wait_for_timeout(1200)
                    break
            except Exception:
                pass

        try:
            page.get_by_label(re.compile("e-?mail", re.I)).first.fill(EMAIL, timeout=4000)
        except Exception:
            page.locator("input[type=email], input[name=email]").first.fill(EMAIL)
        try:
            page.get_by_label(re.compile("password|adgangskode|kode", re.I)).first.fill(PASSWORD, timeout=4000)
        except Exception:
            page.locator("input[type=password]").first.fill(PASSWORD)
        shoot(page, "02-login-filled")

        for sel in ["button[type=submit]", "text=Log ind", "text=Login", "text=Sign in"]:
            try:
                page.locator(sel).first.click(timeout=2500)
                break
            except Exception:
                pass
        page.wait_for_load_state("networkidle", timeout=45000)
        page.wait_for_timeout(2500)
        shoot(page, "03-after-login")

        # Walk whatever primary navigation exists. Collect nav link labels/hrefs,
        # then visit each, screenshotting as we go.
        links = []
        for a in page.locator("nav a, header a, aside a, [role=navigation] a").all():
            try:
                label = (a.inner_text() or "").strip().split("\n")[0][:30]
                href = a.get_attribute("href") or ""
                if href and href not in ("#", "/") and not href.startswith("http"):
                    links.append((label, href))
            except Exception:
                pass
        # de-dup, cap so a huge menu doesn't run forever
        seen, uniq = set(), []
        for label, href in links:
            if href not in seen:
                seen.add(href)
                uniq.append((label, href))
        uniq = uniq[:10]
        print(f"nav links found: {uniq}")

        base = f"{urlparse(page.url).scheme}://{urlparse(page.url).netloc}"
        for i, (label, href) in enumerate(uniq, start=4):
            try:
                page.goto(base + href, wait_until="networkidle", timeout=30000)
                safe = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or f"page{i}"
                shoot(page, f"{i:02d}-{safe}")
            except Exception as exc:
                print(f"  skip {href}: {type(exc).__name__}")

        ctx.close()
        browser.close()

    report = {
        "backends": sorted(backends),
        "rest_tables": sorted(rest_tables),
        "rpc_functions": sorted(rpc_calls),
        "routes": routes_seen,
    }
    Path(SHOTS.parent / "network-model.json").write_text(json.dumps(report, indent=2))
    print("\n=== DISCOVERED ===")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
