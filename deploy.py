#!/usr/bin/python3
from pathlib import Path
import re
import json
import shutil
import os
import sys
import subprocess

SRC_DIR = Path("/home/jon/proj/pa")
BUILD_DIR = SRC_DIR / "build"
STAGING_BUCKET = "s3://staging.apps.hursts.org.uk-920541147914-eu-west-2-an/pa"
PROD_BUCKET = "s3://apps.hursts.org.uk-920541147914-eu-west-2-an/pa"

# load metadata from sw.js
sw = (SRC_DIR / "sw.js").read_text()
mo = re.match(r"const META = ({[^}]*})", sw, flags=re.MULTILINE)
if not mo:
    print("Meta section of sw.js not found", file=sts.stderr)
    sys.exit(-1)
meta = json.loads(mo.group(1))
# copy files to build directory
shutil.rmtree(BUILD_DIR, ignore_errors=True)
os.mkdir(BUILD_DIR)
for f in meta["MANIFEST"]:
    shutil.copy(SRC_DIR / f, BUILD_DIR)
shutil.copy(SRC_DIR / "sw.js", BUILD_DIR)
# update index.html with version from sw.js
new = (BUILD_DIR / "index.html").read_text().replace(
    '<span id="version"></span>',
    f'<span id="version">{meta["VERSION"]}</span>')
(BUILD_DIR / "index.html").write_text(new)
# sync to s3
bucket = STAGING_BUCKET
if len(sys.argv) == 2 and sys.argv[1] == "--prod":
    bucket = PROD_BUCKET
else:
    print("Uploading to staging. Use --prod to upload to production")
subprocess.run([
    "aws", "s3", "sync",
    BUILD_DIR, bucket,
    "--exclude", "*.html",
    "--metadata", f"version={meta['VERSION']}",
    "--cache-control='no-cache'"])
subprocess.run([
    "aws", "s3", "sync",
    BUILD_DIR, bucket,
    "--exclude", "*", "--include", "*.html",
    "--metadata", f"version={meta['VERSION']}",
    "--cache-control='no-cache'"])
