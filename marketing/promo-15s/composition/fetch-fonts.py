"""Downloads the Google Fonts used by the composition (OFL) into ./fonts and writes fonts/fonts.css."""
import hashlib, re, subprocess
from pathlib import Path
here = Path(__file__).resolve().parent
out = here / 'fonts'; out.mkdir(exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
URL = ('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Shippori+Mincho:wght@600;700;800'
       '&family=Noto+Sans+JP:wght@500;700;900&family=JetBrains+Mono:wght@500;700&display=block')
css = subprocess.run(['curl', '-sS', '-A', UA, URL], check=True, capture_output=True, text=True).stdout
urls = sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)))
cfg = []
for u in urls:
    name = 'f_' + hashlib.sha1(u.encode()).hexdigest()[:16] + '.woff2'
    css = css.replace(u, name)
    cfg.append(f'url = "{u}"\noutput = "{out / name}"\n')
(out / 'urls.txt').write_text(''.join(cfg))
subprocess.run(['curl', '-sS', '--parallel', '--parallel-max', '16', '-K', str(out / 'urls.txt')], check=True)
(out / 'fonts.css').write_text(css)
print(len(urls), 'font files')
