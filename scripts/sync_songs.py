"""Sync new songs from archive.org into the site's song list.

Runs on GitHub every few hours (see .github/workflows/sync-songs.yml).
For every Alec Penn Radio item on archive.org it:
  - adds songs that are on archive.org but not on the site yet
    (length, loudness and cover art are read from the MP3 itself)
  - drops songs that were removed from archive.org
Songs listed in scripts/blocklist.txt never appear, even if they're on archive.org.

Usage: python scripts/sync_songs.py public/station.json
"""
import io, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request

DATA = sys.argv[1]
ROOT = os.path.dirname(DATA)
COVERS = os.path.join(ROOT, "covers")
HERE = os.path.dirname(os.path.abspath(__file__))
BLOCK = os.path.join(HERE, "blocklist.txt")
PREFIX = "alecpennradio-"
TARGET_LUFS = -14.0
UA = {"User-Agent": "alec-penn-radio-sync/1.0"}
MAX_REMOVE = 10   # safety: never drop more than this many songs from one collection in one run


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read()
        except Exception as e:
            print("  retry", url, e)
            time.sleep(10 * (i + 1))
    raise RuntimeError("could not fetch " + url)


def blocked():
    out = set()
    if os.path.exists(BLOCK):
        for line in open(BLOCK, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#"):
                out.add(line)
    return out


def measure(path):
    """length (s), integrated loudness (LUFS), true peak (dBTP)"""
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                               capture_output=True, text=True).stdout.strip())
    log = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summ = log[log.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+|-inf) LUFS", summ).group(1).replace("-inf", "-70"))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summ).group(1).replace("-inf", "-70"))
    return dur, lufs, peak


def song_info(path, fallback_title):
    from mutagen.id3 import ID3
    title, art = None, None
    try:
        tags = ID3(path)
        if "TIT2" in tags and str(tags["TIT2"]).strip():
            title = str(tags["TIT2"]).strip()
        pics = tags.getall("APIC")
        front = [p for p in pics if p.type == 3] or pics
        if front:
            art = front[0].data
    except Exception:
        pass
    return title or fallback_title, art


def make_cover(art, title, out):
    from PIL import Image, ImageDraw, ImageFont
    if art:
        im = Image.open(io.BytesIO(art)).convert("RGB")
    else:  # plain gold-on-black card if the MP3 has no cover
        im = Image.new("RGB", (320, 320), "#0A0806")
        d = ImageDraw.Draw(im)
        d.rectangle((14, 14, 305, 305), outline="#C2A24D", width=3)
        try:
            f = ImageFont.truetype("DejaVuSans-Bold.ttf", 26)
        except Exception:
            f = ImageFont.load_default()
        d.multiline_text((160, 160), "\n".join(re.findall(r".{1,16}(?:\s|$)", title.upper()))[:80], font=f,
                         fill="#C2A24D", anchor="mm", align="center")
    im.resize((320, 320), Image.LANCZOS).save(out, "WEBP", quality=82)


def nice_title(fname):
    return re.sub(r"\s*\(\d+\)$", "", os.path.splitext(fname)[0]).strip()


def discover(data):
    """add a channel for any new Alec Penn Radio collection on archive.org"""
    q = urllib.parse.quote(f'identifier:{PREFIX}* AND creator:"Alec Penn Radio"')
    try:
        res = json.loads(get(f"https://archive.org/advancedsearch.php?q={q}&fl[]=identifier&fl[]=title&rows=200&output=json"))
    except Exception as e:
        print("search failed, skipping new collections:", e)
        return False
    known = {c["ia"] for c in data["channels"]}
    added = False
    for doc in res["response"]["docs"]:
        ident = doc["identifier"]
        if ident in known or re.search(r"-\d+$", ident):
            continue
        slug = ident[len(PREFIX):]
        name = str(doc.get("title", slug)).split("·")[-1].strip() or slug.replace("-", " ").title()
        print(f"NEW COLLECTION: {name} ({ident})")
        data["channels"].append({"folder": name.upper(), "slug": slug, "ia": ident, "name": name, "tracks": []})
        added = True
    return added


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    block = blocked()
    changed = discover(data)
    tmp = tempfile.mkdtemp()
    stats = {"checked": 0, "unreachable": 0, "added": 0, "removed": 0, "blocked_on_ia": 0}
    for ch in data["channels"]:
        try:
            meta = json.loads(get(f"https://archive.org/metadata/{ch['ia']}"))
        except Exception as e:
            print(f"{ch['name']}: archive.org didn't answer, leaving it alone ({e})")
            stats["unreachable"] += 1
            continue
        files = meta.get("files") or []
        originals = [f["name"] for f in files if f.get("source") == "original" and f["name"].lower().endswith(".mp3")]
        if not originals:
            print(f"{ch['name']}: no songs listed on archive.org, leaving it alone")
            stats["unreachable"] += 1
            continue
        stats["checked"] += 1
        on_ia = set(originals)
        if ch.get("hidden"):   # a new station waiting for its upload: switch it on once (nearly) all its songs are there
            have_n = sum(1 for t in ch["tracks"] if t["f"] in on_ia)
            if ch["tracks"] and have_n >= len(ch["tracks"]) - MAX_REMOVE:
                del ch["hidden"]; changed = True
                print(f"{ch['name']}: uploaded ({have_n}/{len(ch['tracks'])} songs) - now on air")
            else:
                print(f"{ch['name']}: still uploading ({have_n}/{len(ch['tracks'])}), staying hidden")
                continue
        is_blocked = lambda name: f"{ch['ia']}/{name}" in block
        stats["blocked_on_ia"] += sum(1 for n in originals if is_blocked(n))

        gone = [t for t in ch["tracks"] if t["f"] not in on_ia or is_blocked(t["f"])]
        if gone and len(gone) <= MAX_REMOVE:
            for t in gone:
                print(f"{ch['name']}: removing {t['f']}")
            ch["tracks"] = [t for t in ch["tracks"] if t not in gone]
            stats["removed"] += len(gone)
            changed = True
        elif gone:
            print(f"{ch['name']}: {len(gone)} songs look missing - too many to remove automatically, skipping")

        have = {t["f"] for t in ch["tracks"]}
        new = sorted(n for n in originals if n not in have and not is_blocked(n))
        if not new:
            continue
        os.makedirs(os.path.join(COVERS, ch["slug"]), exist_ok=True)
        next_c = max([t.get("c", i) for i, t in enumerate(ch["tracks"])] + [-1]) + 1
        for name in new:
            url = f"https://archive.org/download/{ch['ia']}/{urllib.parse.quote(name)}"
            path = os.path.join(tmp, "song.mp3")
            try:
                open(path, "wb").write(get(url))
                dur, lufs, peak = measure(path)
                title, art = song_info(path, nice_title(name))
                while os.path.exists(os.path.join(COVERS, ch["slug"], f"{next_c}.webp")):
                    next_c += 1
                make_cover(art, title, os.path.join(COVERS, ch["slug"], f"{next_c}.webp"))
            except Exception as e:
                print(f"{ch['name']}: couldn't add {name}, will try next time ({e})")
                continue
            gain = round(min(TARGET_LUFS - lufs, -1.0 - peak, 6.0), 1)
            ch["tracks"].append({"t": title, "f": name, "s": round(dur, 1), "g": gain, "c": next_c})
            print(f"{ch['name']}: added {title}  ({dur:.0f}s, {lufs:.1f} LUFS, gain {gain})")
            next_c += 1
            stats["added"] += 1
            changed = True
        ch["tracks"].sort(key=lambda t: t["t"].lower())

    total = sum(len(c["tracks"]) for c in data["channels"])
    # shows up on the run's page on GitHub
    print("::notice title=Song sync::" + ", ".join(f"{k.replace('_', ' ')} {v}" for k, v in stats.items()) + f", total songs {total}")
    if changed:
        json.dump(data, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        total = sum(len(c["tracks"]) for c in data["channels"])
        print(f"Saved. {total} songs in total.")
    else:
        print("Nothing new.")


if __name__ == "__main__":
    main()
