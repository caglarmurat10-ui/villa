#!/usr/bin/env python3
"""TestFlight yukleme sonrasi otomasyonu.

Yuklenen build'i App Store Connect'te bulur, export compliance durumunu
dogrular ve build'i internal test grubuna ekler. Mevcut tester/gruplari
bozmaz: internal grup varsa yeniden kullanilir, yoksa olusturulur.

Gerekli ortam degiskenleri (degerleri asla loglanmaz):
  APPSTORE_ISSUER_ID, APPSTORE_API_KEY_ID, APPSTORE_API_PRIVATE_KEY
  BUNDLE_ID, BUILD_VERSION (CFBundleVersion, or. "7")
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import jwt

BASE = "https://api.appstoreconnect.apple.com/v1"
BUNDLE_ID = os.environ["BUNDLE_ID"]
BUILD_VERSION = os.environ["BUILD_VERSION"]
INTERNAL_GROUP_NAME = os.environ.get("INTERNAL_GROUP_NAME", "Internal Testers")
POLL_ATTEMPTS = int(os.environ.get("POLL_ATTEMPTS", "40"))
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "30"))


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "iss": os.environ["APPSTORE_ISSUER_ID"],
            "iat": now,
            "exp": now + 1200,
            "aud": "appstoreconnect-v1",
        },
        os.environ["APPSTORE_API_PRIVATE_KEY"],
        algorithm="ES256",
        headers={"alg": "ES256", "kid": os.environ["APPSTORE_API_KEY_ID"], "typ": "JWT"},
    )


TOKEN = token()


def req(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read().decode()
            return response.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:600]
        return error.code, {"_error": detail}


def fail(message: str) -> "NoReturn":
    print(f"HATA: {message}", file=sys.stderr)
    sys.exit(1)


# --- 1. Uygulama kaydi ---
bundle_query = urllib.parse.quote(BUNDLE_ID, safe="")
status, payload = req("GET", f"/apps?filter%5BbundleId%5D={bundle_query}&limit=1")
apps = payload.get("data", []) if status == 200 else []
if not apps:
    fail(
        f"App Store Connect'te {BUNDLE_ID} icin uygulama kaydi bulunamadi. "
        "Kayit App Store Connect arayuzunden olusturulmali."
    )
app = apps[0]
app_id = app["id"]
print(f"APP_ID={app_id} name={app['attributes'].get('name')}")

# --- 2. Build'i bul (processing bitene kadar bekle) ---
build = None
for attempt in range(1, POLL_ATTEMPTS + 1):
    status, payload = req(
        "GET",
        f"/builds?filter%5Bapp%5D={app_id}&filter%5Bversion%5D={BUILD_VERSION}"
        "&fields%5Bbuilds%5D=version,processingState,expired,usesNonExemptEncryption&limit=1",
    )
    candidates = payload.get("data", []) if status == 200 else []
    if candidates:
        build = candidates[0]
        state = build["attributes"].get("processingState")
        print(f"deneme={attempt} build={build['id']} processingState={state}")
        if state == "VALID":
            break
        if state == "FAILED":
            fail("Build processing FAILED durumunda.")
    else:
        print(f"deneme={attempt} build henuz gorunmuyor")
    if attempt == POLL_ATTEMPTS:
        fail("Build processing zaman asimina ugradi.")
    time.sleep(POLL_SECONDS)

build_id = build["id"]
print(f"BUILD_ID={build_id} PROCESSING=VALID")

# --- 3. Export compliance ---
uses_non_exempt = build["attributes"].get("usesNonExemptEncryption")
if uses_non_exempt is None:
    status, payload = req(
        "PATCH",
        f"/builds/{build_id}",
        {"data": {"type": "builds", "id": build_id,
                  "attributes": {"usesNonExemptEncryption": False}}},
    )
    if status not in (200, 201):
        fail(f"Export compliance ayarlanamadi http={status} {payload.get('_error', '')}")
    print("EXPORT_COMPLIANCE=SET usesNonExemptEncryption=false")
else:
    print(f"EXPORT_COMPLIANCE=ALREADY_SET usesNonExemptEncryption={uses_non_exempt}")

# --- 4. Internal test grubu (mevcut gruplar korunur) ---
status, payload = req(
    "GET",
    f"/apps/{app_id}/betaGroups?fields%5BbetaGroups%5D=name,isInternalGroup&limit=200",
)
if status != 200:
    fail(f"Beta gruplari okunamadi http={status}")
groups = payload.get("data", [])
for group in groups:
    attrs = group["attributes"]
    kind = "internal" if attrs.get("isInternalGroup") else "external"
    print(f"  mevcut grup: {attrs.get('name')} ({kind})")

internal = [g for g in groups if g["attributes"].get("isInternalGroup")]
target = next(
    (g for g in internal if g["attributes"].get("name") == INTERNAL_GROUP_NAME),
    internal[0] if internal else None,
)

if target is None:
    status, payload = req(
        "POST",
        "/betaGroups",
        {"data": {"type": "betaGroups",
                  "attributes": {"name": INTERNAL_GROUP_NAME, "isInternalGroup": True},
                  "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}},
    )
    if status not in (200, 201):
        fail(f"Internal grup olusturulamadi http={status} {payload.get('_error', '')}")
    target = payload["data"]
    print(f"INTERNAL_GROUP_CREATED={target['id']} name={INTERNAL_GROUP_NAME}")
else:
    print(f"INTERNAL_GROUP_EXISTS={target['id']} name={target['attributes'].get('name')}")

# --- 5. Build'i gruba ekle (idempotent) ---
group_id = target["id"]
status, payload = req("GET", f"/betaGroups/{group_id}/builds?limit=200")
existing = {b["id"] for b in payload.get("data", [])} if status == 200 else set()
if build_id in existing:
    print("BUILD_ALREADY_IN_GROUP=true")
else:
    status, payload = req(
        "POST",
        f"/betaGroups/{group_id}/relationships/builds",
        {"data": [{"type": "builds", "id": build_id}]},
    )
    if status not in (200, 201, 204):
        fail(f"Build gruba eklenemedi http={status} {payload.get('_error', '')}")
    print("BUILD_ADDED_TO_GROUP=true")

# --- 6. Ozet ---
status, payload = req(
    "GET",
    f"/builds/{build_id}?fields%5Bbuilds%5D=version,processingState,expired,usesNonExemptEncryption",
)
attrs = payload.get("data", {}).get("attributes", {}) if status == 200 else {}
print(f"APPLE_APP_ID={app_id}")
print(f"FINAL_BUILD_VERSION={attrs.get('version')}")
print(f"FINAL_PROCESSING_STATE={attrs.get('processingState')}")
print(f"FINAL_EXPIRED={attrs.get('expired')}")
print("TESTFLIGHT_POST_UPLOAD=PASS")
